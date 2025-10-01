const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cluster = require('cluster');
const os = require('os');
dotenv.config();

// Get number of CPU cores
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // Restart the worker
    cluster.fork();
  });
} else {
  const app = express();
  const PORT = process.env.PORT || 5000;
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isProduction = NODE_ENV === 'production';

  console.log(`Worker ${process.pid} started`);

  // CORS configuration
  const corsOptions = {
    origin: isProduction 
      ? [process.env.CLIENT_URL || 'https://alpstech-learning.vercel.app'] 
      : ['http://localhost:8080', 'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  };

  // Middleware
  app.use(cors(corsOptions));
  app.use(express.json());

  // Rate limiting middleware
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);

  // Authentication middleware
  app.use(async (req, res, next) => {
    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return next();
      }

      // Extract email from authorization header
      const email = authHeader.split(' ')[1];
      if (!email) {
        return next();
      }

      // Find user in database
      const db = req.app.locals.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      const user = await db.collection('users').findOne({ email });
      if (user) {
        req.user = user;
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      next();
    }
  });

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    // Only log body in development to avoid sensitive data in logs
    if (!isProduction) {
      console.log('Request Body:', req.body);
    }
    next();
  });

  // Import routes
  const dashboardRoutes = require('./routes/dashboard');
  const studentRoutes = require('./routes/students');
  const courseRoutes = require('./routes/courses');
  const resultRoutes = require('./routes/results');
  const studentRouter = require('./routes/student');
  const assignmentRoutes = require('./routes/assignments');
  // MongoDB Connection
const uri = process.env.MONGO_URI || process.env.VITE_MONGO_URI;
console.log('MongoDB URI configured:', uri ? 'Yes' : 'No');

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  async function connectToMongoDB() {
    try {
      await client.connect();
      console.log('Connected to MongoDB');
      app.locals.db = client.db('alpstech');
      // Test the connection by listing collections
      const collections = await app.locals.db.listCollections().toArray();
      console.log('Available collections:', collections.map(c => c.name));
      return true;
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      return false;
    }
  }

  // Connect to MongoDB when server starts
  connectToMongoDB().catch(console.error);

  // API Routes
  const apiRouter = express.Router();

  // Test connection route
  apiRouter.get('/test-connection', async (req, res) => {
    try {
      if (!app.locals.db) {
        const connected = await connectToMongoDB();
        if (!connected) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to connect to database' 
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Successfully connected to MongoDB' 
      });
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'An error occurred while testing connection' 
      });
    }
  });

  // User routes
  apiRouter.post('/users', async (req, res) => {
    try {
      if (!app.locals.db) await connectToMongoDB();
      
      const userData = req.body;
      console.log('Received user data:', userData);
      
      // Validate required fields
      if (!userData.name || !userData.email || !userData.password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }
      
      // Check if user exists
      const existingUser = await app.locals.db.collection('users').findOne({ email: userData.email });
      if (existingUser) {
        console.log('User already exists:', userData.email);
        return res.status(400).json({ 
          success: false, 
          message: 'User with this email already exists' 
        });
      }
      
      // Ensure required arrays are initialized
      if (!userData.enrolledCourses) userData.enrolledCourses = [];
      if (!userData.results) userData.results = [];
      
      // Create user
      const result = await app.locals.db.collection('users').insertOne({
        ...userData,
        createdAt: new Date()
      });
      
      console.log('User created:', result.insertedId.toString());
      
      res.status(201).json({ 
        success: true, 
        data: { 
          id: result.insertedId.toString(),
          ...userData 
        } 
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'An error occurred while creating the user'
      });
    }
  });

  apiRouter.get('/users', async (req, res) => {
    try {
      if (!app.locals.db) await connectToMongoDB();
      
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email parameter is required' 
        });
      }
      
      console.log('Looking for user with email:', email);
      const user = await app.locals.db.collection('users').findOne({ email });
      
      if (!user) {
        console.log('User not found:', email);
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      // Convert _id to string
      const { _id, ...userData } = user;
      console.log('User found:', _id.toString());
      
      res.json({ 
        success: true, 
        data: { 
          id: _id.toString(), 
          ...userData 
        } 
      });
    } catch (error) {
      console.error('Find user error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'An error occurred while finding the user'
      });
    }
  });

  apiRouter.patch('/users/:userId/enroll', async (req, res) => {
    try {
      if (!app.locals.db) await connectToMongoDB();
      
      const { userId } = req.params;
      const { courseId } = req.body;
      
      if (!courseId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Course ID is required' 
        });
      }
      
      console.log(`Enrolling user ${userId} in course ${courseId}`);
      const result = await app.locals.db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { enrolledCourses: courseId } }
      );
      
      if (result.matchedCount === 0) {
        console.log('User not found for enrollment:', userId);
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      console.log('Enrollment successful:', result.modifiedCount > 0);
      res.json({ 
        success: true, 
        data: { 
          modifiedCount: result.modifiedCount 
        } 
      });
    } catch (error) {
      console.error('Update enrollment error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'An error occurred while updating enrollment'
      });
    }
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Use routes
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/admin/students', studentRoutes);
  app.use('/api/admin/courses', courseRoutes);
  app.use('/api/admin/results', resultRoutes);
  app.use('/api/student', studentRouter);
  app.use('/api/courses', courseRoutes);
  app.use('/api', assignmentRoutes);

  // In production, serve static files from the build directory
  if (isProduction) {
    // Serve static files from the React build
    app.use(express.static(path.join(__dirname, '../dist')));

    // Handle all other routes by serving the React app
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  // Global error handler for Multer and all errors
  app.use((err, req, res, next) => {
    const multer = require('multer');
    if (err instanceof multer.MulterError || err.message === 'Only PDF files are allowed!') {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  });

  // Start server
  connectToMongoDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  }).catch((error) => {
    console.error('Failed to start server:', error);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await client.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      process.exit(1);
    }
  });
} 
