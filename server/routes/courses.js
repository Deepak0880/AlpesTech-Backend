const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Get all courses
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const courses = await db.collection('courses')
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
});

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const course = await db.collection('courses').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch course'
    });
  }
});

// Create new course
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const courseData = {
      ...req.body,
      createdAt: new Date()
    };

    const result = await db.collection('courses').insertOne(courseData);
    const insertedCourse = await db.collection('courses').findOne({
      _id: result.insertedId
    });

    res.status(201).json({
      success: true,
      data: insertedCourse
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create course'
    });
  }
});

// Update course
router.patch('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('courses').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: result.value
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update course'
    });
  }
});

// Delete course
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('courses').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete course'
    });
  }
});

module.exports = router; 