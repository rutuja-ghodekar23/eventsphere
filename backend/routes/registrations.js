const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

let QRCode = null;
let sendRegistrationEmail = null;
try { QRCode = require('qrcode'); } catch(e) {}
try { sendRegistrationEmail = require('../utils/email').sendRegistrationEmail; } catch(e) {}

// POST /api/registrations
router.post('/', auth, async (req, res) => {
  const { event_id, requirements } = req.body;
  const user_id = req.user.user_id;
  if (!event_id) return res.status(400).json({ message: 'Event ID required.' });
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [evs] = await conn.query('SELECT * FROM events WHERE event_id=? FOR UPDATE', [event_id]);
    if (!evs.length) { await conn.rollback(); return res.status(404).json({ message: 'Event not found.' }); }
    const ev = evs[0];
    if (ev.status === 'Completed') { await conn.rollback(); return res.status(400).json({ message: 'Event already completed.' }); }

    const [dup] = await conn.query('SELECT registration_id FROM registrations WHERE user_id=? AND event_id=?', [user_id, event_id]);
    if (dup.length) { await conn.rollback(); return res.status(409).json({ message: 'Already registered for this event.' }); }

    // If full → auto-add to waitlist
    if (ev.registered_count >= ev.capacity) {
      await conn.rollback();
      try {
        await db.query('INSERT IGNORE INTO waitlist (user_id, event_id) VALUES (?,?)', [user_id, event_id]);
      } catch(e2) {}
      return res.status(200).json({ waitlisted: true, message: 'Event full! Added to waitlist.' });
    }

    const [r] = await conn.query(
      'INSERT INTO registrations (user_id, event_id, requirements) VALUES (?,?,?)',
      [user_id, event_id, requirements||'']
    );
    await conn.query('UPDATE events SET registered_count=registered_count+1 WHERE event_id=?', [event_id]);
    // Remove from waitlist if they were on it
    await conn.query('DELETE FROM waitlist WHERE user_id=? AND event_id=?', [user_id, event_id]);
    await conn.commit();

    const registrationId = r.insertId;
    const bookingId = `ES-${String(registrationId).padStart(6,'0')}`;

    let qrDataUrl = null;
    const qrPayload = JSON.stringify({ booking_id:bookingId, registration_id:registrationId, user_id, event_id, event_title:ev.title, venue:ev.venue, city:ev.city, date:ev.date });
    if (QRCode) { try { qrDataUrl = await QRCode.toDataURL(qrPayload, { width:300, margin:2 }); } catch(e) {} }

    if (sendRegistrationEmail && req.user.email && process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com') {
      sendRegistrationEmail({ to:req.user.email, name:req.user.name, eventTitle:ev.title, eventDate:ev.date, venue:ev.venue, city:ev.city, registrationId, qrDataUrl:qrDataUrl||'' }).catch(err => console.warn('Email failed:', err.message));
    }

    res.status(201).json({ message:'Successfully registered!', registration_id:registrationId, booking_id:bookingId, event_title:ev.title, event_date:ev.date, venue:ev.venue, city:ev.city, category:ev.category, qr_code:qrDataUrl });
  } catch(e) {
    if (conn) { try { await conn.rollback(); } catch(re) {} }
    console.error('[Registration Error]', e.code, e.message);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Already registered.' });
    if (e.code === 'ER_NO_SUCH_TABLE') return res.status(500).json({ message: 'Database not set up. Run schema.sql first.' });
    if (e.code === 'ECONNREFUSED' || e.code === 'PROTOCOL_CONNECTION_LOST') return res.status(500).json({ message: 'Database connection failed. Check MySQL is running.' });
    res.status(500).json({ message: 'Registration failed: ' + (e.message || 'Server error') });
  } finally { if (conn) conn.release(); }
});

// GET /api/registrations/my
router.get('/my', auth, async (req, res) => {
  try {
    const [regs] = await db.query(
      `SELECT e.*, r.registration_id, r.registered_at, r.requirements,
       CONCAT('ES-', LPAD(r.registration_id, 6, '0')) AS booking_id
       FROM registrations r JOIN events e ON r.event_id=e.event_id
       WHERE r.user_id=? ORDER BY r.registered_at DESC`,
      [req.user.user_id]
    );
    res.json({ registrations: regs });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/registrations/qr/:id
router.get('/qr/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT r.*, e.title, e.venue, e.city, e.date FROM registrations r JOIN events e ON r.event_id=e.event_id WHERE r.registration_id=? AND r.user_id=?',
      [req.params.id, req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Registration not found.' });
    const reg = rows[0];
    const bookingId = `ES-${String(reg.registration_id).padStart(6,'0')}`;
    const payload = JSON.stringify({ booking_id:bookingId, registration_id:reg.registration_id, event_title:reg.title, venue:reg.venue, city:reg.city, date:reg.date });
    if (!QRCode) return res.status(501).json({ message: 'QR generation not available. Run: npm install' });
    const qrDataUrl = await QRCode.toDataURL(payload, { width:300, margin:2 });
    res.json({ qr_code:qrDataUrl, booking_id:bookingId, event_title:reg.title });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/registrations/all
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const [regs] = await db.query(
      `SELECT r.*, u.name AS user_name, u.email AS user_email,
       e.title AS event_title, e.city, e.category, e.date,
       CONCAT('ES-', LPAD(r.registration_id, 6, '0')) AS booking_id
       FROM registrations r JOIN users u ON r.user_id=u.user_id JOIN events e ON r.event_id=e.event_id
       ORDER BY r.registered_at DESC`
    );
    res.json({ registrations: regs, total: regs.length });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// DELETE /api/registrations/:event_id
router.delete('/:event_id', auth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [chk] = await conn.query('SELECT registration_id FROM registrations WHERE user_id=? AND event_id=?', [req.user.user_id, req.params.event_id]);
    if (!chk.length) { await conn.rollback(); return res.status(404).json({ message: 'Registration not found.' }); }
    await conn.query('DELETE FROM registrations WHERE user_id=? AND event_id=?', [req.user.user_id, req.params.event_id]);
    await conn.query('UPDATE events SET registered_count=GREATEST(registered_count-1,0) WHERE event_id=?', [req.params.event_id]);
    await conn.commit();
    // Notify first person on waitlist
    try {
      const { notifyWaitlistFirst } = require('./waitlist');
      notifyWaitlistFirst(req.params.event_id).catch(()=>{});
    } catch(e2) {}
    res.json({ message: 'Registration cancelled.' });
  } catch(e) {
    if (conn) await conn.rollback();
    res.status(500).json({ message: 'Server error.' });
  } finally { if (conn) conn.release(); }
});

module.exports = router;
