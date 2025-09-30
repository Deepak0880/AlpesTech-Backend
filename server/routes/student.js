const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Get results for the currently logged-in student
router.get('/results', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Get the current user's email from the session
    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find all results for this student
    const results = await db.collection('results')
      .find({ studentEmail: userEmail })
      .sort({ date: -1 })
      .toArray();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching student results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results'
    });
  }
});

module.exports = router; 