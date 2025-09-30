const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Set up multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/assignments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed!'));
}});

// Admin uploads assignment for a course
router.post('/admin/courses/:courseId/assignments', upload.single('pdf'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { courseId } = req.params;
    const { title, description } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'PDF file is required' });

    const assignment = {
      courseId: new ObjectId(courseId),
      title,
      description,
      pdfPath: req.file.filename,
      createdAt: new Date()
    };
    const result = await db.collection('assignments').insertOne(assignment);
    res.status(201).json({ success: true, data: { ...assignment, _id: result.insertedId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload assignment' });
  }
});

// Get assignments for a course
router.get('/courses/:courseId/assignments', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { courseId } = req.params;
    const assignments = await db.collection('assignments')
      .find({ courseId: new ObjectId(courseId) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch assignments' });
  }
});

// Serve assignment PDF
router.get('/assignments/:assignmentId/pdf', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { assignmentId } = req.params;
    const assignment = await db.collection('assignments').findOne({ _id: new ObjectId(assignmentId) });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const filePath = path.join(__dirname, '../uploads/assignments', assignment.pdfPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'PDF not found' });

    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to serve PDF' });
  }
});

module.exports = router;

// Error handler for Multer and file upload errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only PDF files are allowed!') {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
}); 