const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Get all results
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const results = await db.collection('results')
      .find()
      .sort({ date: -1 })
      .toArray();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results'
    });
  }
});

// Get result by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('results').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Result not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch result'
    });
  }
});

// Create new result
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const resultData = {
      ...req.body,
      createdAt: new Date()
    };

    const result = await db.collection('results').insertOne(resultData);
    const insertedResult = await db.collection('results').findOne({
      _id: result.insertedId
    });

    res.status(201).json({
      success: true,
      data: insertedResult
    });
  } catch (error) {
    console.error('Error creating result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create result'
    });
  }
});

// Update result
router.patch('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('results').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        error: 'Result not found'
      });
    }

    res.json({
      success: true,
      data: result.value
    });
  } catch (error) {
    console.error('Error updating result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update result'
    });
  }
});

// Delete result
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('results').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Result not found'
      });
    }

    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error('Error deleting result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete result'
    });
  }
});

module.exports = router; 