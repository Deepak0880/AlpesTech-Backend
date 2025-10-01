const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// MongoDB Singleton
let mongoClient;
async function getDb() {
  if (!mongoClient) {
    const uri = process.env.MONGO_URI || process.env.VITE_MONGO_URI;
    if (!uri) throw new Error('MongoDB URI not configured');
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
      tlsAllowInvalidCertificates: true, // remove in production
      tlsAllowInvalidHostnames: true,    // remove in production
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await mongoClient.connect();
    console.log('Connected to MongoDB');
  }
  return mongoClient.db('alpstech');
}

// Cluster setup
const numCPUs = os.cpus().length;
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  const app = express();
  app.set('trust proxy', 1);

  // Middleware
  const corsOptions = {
    origin: isProduction
      ? [process.env.CLIENT_URL || 'https://alpstech-learning.vercel.app']
      : ['http://localhost:8080', 'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  };
  app.use(cors(corsOptions));
  app.use(express.json());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });
  app.use(limiter);

  // Logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (!isProduction) {
      const body = { ...req.body };
      if (body.password) body.password = '****';
      console.log('Request Body:', body);
    }
    next();
  });

  // JWT Authentication middleware
  app.use(async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      const token = authHeader.split(' ')[1];
      if (!token) return next();

      const decoded = jwt.verify(token, JWT_SECRET);
      const db = await getDb();
      const user = await db.collection('users').findOne({ email: decoded.email });
      if (user) req.user = user;
      next();
    } catch (err) {
      console.error('Auth error:', err.message);
      next();
    }
  });

  // Routes
  const dashboardRoutes = require('./routes/dashboard');
  const studentRoutes = require('./routes/students');
  const courseRoutes = require('./routes/courses');
  const resultRoutes = require('./routes/results');
  const studentRouter = require('./routes/student');
  const assignmentRoutes = require('./routes/assignments');

  const apiRouter = express.Router();

  // Test connection
  apiRouter.get('/test-connection', async (req, res) => {
    try {
      const db = await getDb();
      const collections = await db.listCollections().toArray();
      res.json({ success: true, collections: collections.map(c => c.name) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // User routes
  apiRouter.post('/users', async (req, res) => {
    try {
      const db = await getDb();
      const { name, email, password } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Name, email, password required' });

      const existing = await db.collection('users').findOne({ email });
      if (existing) return res.status(400).json({ success: false, message: 'User exists' });

      const userData = { ...req.body, enrolledCourses: [], results: [], createdAt: new Date() };
      const result = await db.collection('users').insertOne(userData);
      const token = jwt.sign({ email: userData.email }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ success: true, data: { id: result.insertedId.toString(), ...userData, token } });
    } catch (err) {
      console.error('Create user error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  apiRouter.get('/users', async (req, res) => {
    try {
      const db = await getDb();
      const { email } = req.query;
      if (!email) return res.status(400).json({ success: false, message: 'Email required' });

      const user = await db.collection('users').findOne({ email });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const { _id, password, ...userData } = user;
      res.json({ success: true, data: { id: _id.toString(), ...userData } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  apiRouter.patch('/users/:userId/enroll', async (req, res) => {
    try {
      const db = await getDb();
      const { userId } = req.params;
      const { courseId } = req.body;
      if (!courseId) return res.status(400).json({ success: false, message: 'Course ID required' });

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { enrolledCourses: courseId } }
      );

      if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, modifiedCount: result.modifiedCount });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Admin and student routes
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/admin/students', studentRoutes);
  app.use('/api/admin/courses', courseRoutes);
  app.use('/api/admin/results', resultRoutes);
  app.use('/api/student', studentRouter);
  app.use('/api/courses', courseRoutes);
  app.use('/api', assignmentRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    const multer = require('multer');
    if (err instanceof multer.MulterError || err.message === 'Only PDF files are allowed!') {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      if (mongoClient) await mongoClient.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('Error closing MongoDB:', err);
      process.exit(1);
    }
  });
}
