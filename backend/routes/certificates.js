const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');

// POST /api/certificates/generate
router.post('/generate', auth, async (req, res) => {
  const { event_id } = req.body;
  const user_id = req.user.user_id;

  if (!event_id) return res.status(400).json({ message: 'event_id required.' });

  try {
    const [ev] = await db.query('SELECT * FROM events WHERE event_id=?', [event_id]);
    if (!ev.length) return res.status(404).json({ message: 'Event not found.' });

    const event = ev[0];
    if (event.status !== 'Completed') {
      return res.status(400).json({ message: 'Certificate only available for completed events.' });
    }

    const [reg] = await db.query(
      'SELECT * FROM registrations WHERE user_id=? AND event_id=?',
      [user_id, event_id]
    );
    if (!reg.length) {
      return res.status(403).json({ message: 'You are not registered for this event.' });
    }

    const registration = reg[0];
    const [user] = await db.query('SELECT name FROM users WHERE user_id=?', [user_id]);
    const userName = user.length ? user[0].name : req.user.name;

    res.json({
      user_name:      userName,
      event_title:    event.title,
      event_date:     event.date,
      category:       event.category,
      city:           event.city,
      certificate_id: `CERT-${registration.registration_id}`
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
