const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const auth    = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// Gracefully handle missing multer
let multer = null;
try { multer = require('multer'); } catch(e) { console.warn('multer not installed — run npm install'); }

if (multer) {
  // Store uploads in frontend/uploads folder so they're served statically
  const uploadDir = path.join(__dirname, '../../frontend/uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random()*1e6);
      cb(null, unique + path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only images allowed (jpg, png, webp, gif)'));
    }
  });

  // POST /api/upload/image — admin only
  router.post('/image', auth, adminOnly, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ message: 'Uploaded!', url, filename: req.file.filename });
  });
} else {
  router.post('/image', auth, adminOnly, (req, res) => {
    res.status(501).json({ message: 'Image upload not available. Run: npm install multer' });
  });
}

module.exports = router;
