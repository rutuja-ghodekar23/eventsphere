const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.post('/', auth, async (req, res) => {
  const { event_id, rating, comment } = req.body;
  if (!event_id || !rating) return res.status(400).json({ message:'Event ID and rating required.' });
  try {
    await db.query('INSERT INTO feedback (user_id,event_id,rating,comment) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating),comment=VALUES(comment)',
      [req.user.user_id, event_id, rating, comment||'']);
    res.status(201).json({ message:'Feedback submitted!' });
  } catch(e) { console.error(e); res.status(500).json({ message:'Server error.' }); }
});

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const [fb] = await db.query(
      'SELECT f.*,u.name AS user_name,e.title AS event_title FROM feedback f JOIN users u ON f.user_id=u.user_id JOIN events e ON f.event_id=e.event_id ORDER BY f.created_at DESC');
    res.json({ feedbacks: fb });
  } catch(e) { res.status(500).json({ message:'Server error.' }); }
});

router.get('/my', auth, async (req, res) => {
  try {
    const [fb] = await db.query(
      'SELECT f.*,e.title AS event_title FROM feedback f JOIN events e ON f.event_id=e.event_id WHERE f.user_id=? ORDER BY f.created_at DESC',
      [req.user.user_id]);
    res.json({ feedbacks: fb });
  } catch(e) { res.status(500).json({ message:'Server error.' }); }
});

module.exports = router;
