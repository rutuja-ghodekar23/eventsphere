const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// POST /api/contact — save message from contact form
router.post('/', async (req, res) => {
  const { firstName, lastName, email, message, topic } = req.body;
  if (!firstName || !email || !message)
    return res.status(400).json({ message: 'Required fields missing.' });
  try {
    await db.query(
      'INSERT INTO contact_messages (first_name, last_name, email, message, topic) VALUES (?,?,?,?,?)',
      [firstName, lastName || '', email, message, topic || 'General']
    );
    res.json({ message: 'Message sent successfully!' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/contact — admin only: get all messages
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const [msgs] = await db.query(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json({ messages: msgs, total: msgs.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/contact/:id — admin only
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE message_id=?', [req.params.id]);
    res.json({ message: 'Message deleted.' });
  } catch (e) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
