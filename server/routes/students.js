const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Get all students with their enrollments
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const students = await db.collection('users')
      .aggregate([
        { $match: { role: 'student' } },
        {
          $lookup: {
            from: 'enrollments',
            localField: '_id',
            foreignField: 'userId',
            as: 'enrollments'
          }
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'enrollments.courseId',
            foreignField: '_id',
            as: 'enrolledCourses'
          }
        },
        {
          $lookup: {
            from: 'results',
            localField: '_id',
            foreignField: 'userId',
            as: 'results'
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            enrolledCourses: {
              $map: {
                input: '$enrolledCourses',
                as: 'course',
                in: {
                  _id: '$$course._id',
                  title: '$$course.title'
                }
              }
            },
            results: {
              $map: {
                input: '$results',
                as: 'result',
                in: {
                  _id: '$$result._id',
                  score: '$$result.score',
                  grade: '$$result.grade',
                  courseId: '$$result.courseId'
                }
              }
            }
          }
        }
      ])
      .toArray();

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

// Get student enrollments
router.get('/enrollments', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const enrollments = await db.collection('enrollments')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'student'
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
            'student': { $arrayElemAt: ['$student', 0] },
            'course': { $arrayElemAt: ['$course', 0] }
          }
        },
        {
          $project: {
            _id: 1,
            enrollmentDate: 1,
            'student.name': 1,
            'student._id': 1,
            'course.title': 1,
            'course._id': 1
          }
        }
      ])
      .toArray();

    res.json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enrollments'
    });
  }
});

module.exports = router; 