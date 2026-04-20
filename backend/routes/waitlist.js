const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

let sendEmail = null;
try { sendEmail = require('../utils/email').sendRegistrationEmail; } catch(e) {}

// POST /api/waitlist/:event_id — join waitlist
router.post('/:event_id', auth, async (req, res) => {
  const user_id  = req.user.user_id;
  const event_id = req.params.event_id;
  try {
    const [ev] = await db.query('SELECT * FROM events WHERE event_id=?', [event_id]);
    if (!ev.length) return res.status(404).json({ message: 'Event not found.' });

    const [alreadyReg] = await db.query(
      'SELECT registration_id FROM registrations WHERE user_id=? AND event_id=?',
      [user_id, event_id]
    );
    if (alreadyReg.length) return res.status(409).json({ message: 'Already registered for this event.' });

    await db.query(
      'INSERT IGNORE INTO waitlist (user_id, event_id) VALUES (?,?)',
      [user_id, event_id]
    );
    res.status(201).json({ message: 'Added to waitlist!' });
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Already on waitlist.' });
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/waitlist/:event_id — leave waitlist
router.delete('/:event_id', auth, async (req, res) => {
  try {
    const [r] = await db.query(
      'DELETE FROM waitlist WHERE user_id=? AND event_id=?',
      [req.user.user_id, req.params.event_id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: 'Not on waitlist.' });
    res.json({ message: 'Removed from waitlist.' });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/waitlist/my — logged-in user's waitlist
router.get('/my', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, w.joined_at, w.id AS waitlist_id
       FROM waitlist w
       JOIN events e ON w.event_id = e.event_id
       WHERE w.user_id = ?
       ORDER BY w.joined_at DESC`,
      [req.user.user_id]
    );
    res.json({ waitlist: rows });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/waitlist/admin/all — waitlist counts per event (admin only)
router.get('/admin/all', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.event_id, e.title, COUNT(w.id) AS waitlist_count
       FROM events e
       LEFT JOIN waitlist w ON e.event_id = w.event_id
       GROUP BY e.event_id, e.title
       ORDER BY waitlist_count DESC`
    );
    res.json({ waitlistCounts: rows });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/waitlist/:event_id — full list (admin only)
router.get('/:event_id', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT w.*, u.name AS user_name, u.email AS user_email
       FROM waitlist w
       JOIN users u ON w.user_id = u.user_id
       WHERE w.event_id = ?
       ORDER BY w.joined_at ASC`,
      [req.params.event_id]
    );
    res.json({ waitlist: rows, total: rows.length });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// Internal helper: notify first person on waitlist after a cancellation
async function notifyWaitlistFirst(event_id) {
  try {
    const [ev] = await db.query('SELECT * FROM events WHERE event_id=?', [event_id]);
    if (!ev.length) return;
    const event = ev[0];

    const [waiting] = await db.query(
      `SELECT w.*, u.name, u.email
       FROM waitlist w
       JOIN users u ON w.user_id = u.user_id
       WHERE w.event_id = ? AND w.notified = 0
       ORDER BY w.joined_at ASC LIMIT 1`,
      [event_id]
    );
    if (!waiting.length) return;
    const person = waiting[0];

    await db.query('UPDATE waitlist SET notified=1 WHERE id=?', [person.id]);

    if (sendEmail && person.email && process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com') {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `EventSphere <${process.env.EMAIL_USER}>`,
        to: person.email,
        subject: `🎉 A spot opened up for ${event.title}!`,
        html: `<div style="font-family:sans-serif;max-width:500px;margin:auto;">
          <h2 style="color:#F5A623;">Good news, ${person.name}!</h2>
          <p>A spot just opened up for <strong>${event.title}</strong>.</p>
          <p>Visit EventSphere now to register before it fills up again!</p>
          <a href="${process.env.FRONTEND_URL||'http://localhost:5000'}/event-details.html?id=${event_id}"
             style="display:inline-block;background:#F5A623;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">
            Register Now →
          </a>
          <p style="color:#999;font-size:12px;margin-top:20px;">EventSphere Waitlist Notification</p>
        </div>`
      }).catch(err => console.warn('Waitlist email failed:', err.message));
    }
  } catch(e) { console.warn('notifyWaitlistFirst error:', e.message); }
}

module.exports = router;
module.exports.notifyWaitlistFirst = notifyWaitlistFirst;
