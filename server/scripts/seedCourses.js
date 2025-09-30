const { MongoClient } = require('mongodb');
require('dotenv').config();

const coursesData = [
  {
    title: "Web Development Fundamentals",
    description: "Learn the basics of web development including HTML, CSS, and JavaScript. Build responsive websites from scratch.",
    instructor: "John Smith",
    duration: "8 weeks",
    level: "beginner",
    price: 14999,
    image: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=2831&auto=format&fit=crop",
    enrollmentStatus: "open",
    createdAt: new Date()
  },
  {
    title: "Advanced JavaScript Programming",
    description: "Master advanced JavaScript concepts including closures, promises, async/await, and modern ES6+ features.",
    instructor: "Sarah Johnson",
    duration: "10 weeks",
    level: "intermediate",
    price: 18999,
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2940&auto=format&fit=crop",
    enrollmentStatus: "open",
    createdAt: new Date()
  },
  {
    title: "Database Management Systems",
    description: "Learn about database design, SQL, NoSQL, and how to integrate databases with applications.",
    instructor: "Michael Chen",
    duration: "12 weeks",
    level: "intermediate",
    price: 22999,
    image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=2021&auto=format&fit=crop",
    enrollmentStatus: "open",
    createdAt: new Date()
  },
  {
    title: "Mobile App Development with React Native",
    description: "Build cross-platform mobile applications using React Native framework for iOS and Android.",
    instructor: "Emily Rodriguez",
    duration: "14 weeks",
    level: "advanced",
    price: 26999,
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=2874&auto=format&fit=crop",
    enrollmentStatus: "in progress",
    createdAt: new Date()
  },
  {
    title: "Cybersecurity Fundamentals",
    description: "Learn the basics of network security, encryption, and protecting systems from cyber threats.",
    instructor: "David Wilson",
    duration: "10 weeks",
    level: "beginner",
    price: 17999,
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=2940&auto=format&fit=crop",
    enrollmentStatus: "open",
    createdAt: new Date()
  },
  {
    title: "Data Science and Machine Learning",
    description: "Introduction to data analysis, statistical methods, and machine learning algorithms using Python.",
    instructor: "Lisa Wong",
    duration: "16 weeks",
    level: "advanced",
    price: 29999,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop",
    enrollmentStatus: "closed",
    createdAt: new Date()
  }
];

async function seedCourses() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('alpstech');
    const coursesCollection = db.collection('courses');

    // Check if courses already exist
    const existingCourses = await coursesCollection.countDocuments();
    if (existingCourses > 0) {
      console.log('Courses already exist in the database. Skipping seed.');
      return;
    }

    // Insert courses
    const result = await coursesCollection.insertMany(coursesData);
    console.log(`Successfully seeded ${result.insertedCount} courses`);

  } catch (error) {
    console.error('Error seeding courses:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function
seedCourses().catch(console.error); 