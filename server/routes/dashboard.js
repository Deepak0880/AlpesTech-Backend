const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const stats = await Promise.all([
      db.collection('courses').countDocuments(),
      db.collection('users').countDocuments({ role: 'student' }),
      db.collection('results').countDocuments(),
      db.collection('courses').countDocuments({ enrollmentStatus: 'open' })
    ]);
    
    res.json({
      success: true,
      data: {
        totalCourses: stats[0],
        totalStudents: stats[1],
        totalResults: stats[2],
        openEnrollments: stats[3]
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get recent enrollments
router.get('/recent-enrollments', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const recentEnrollments = await db.collection('enrollments')
      .aggregate([
        { $sort: { enrollmentDate: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        {
          $project: {
            _id: 1,
            enrollmentDate: 1,
            'user.name': 1,
            'course.title': 1
          }
        }
      ])
      .toArray();
      
    res.json({
      success: true,
      data: recentEnrollments
    });
  } catch (error) {
    console.error('Error fetching recent enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent enrollments'
    });
  }
});

// Get latest results
router.get('/latest-results', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const latestResults = await db.collection('results')
      .aggregate([
        { $sort: { date: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        {
          $project: {
            _id: 1,
            score: 1,
            maxScore: 1,
            grade: 1,
            date: 1,
            'user.name': 1,
            'course.title': 1
          }
        }
      ])
      .toArray();
      
    res.json({
      success: true,
      data: latestResults
    });
  } catch (error) {
    console.error('Error fetching latest results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest results'
    });
  }
});

module.exports = router; 