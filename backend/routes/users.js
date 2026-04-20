const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// GET /api/users — admin: all users
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT user_id, name, email, college, city, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users, total: users.length });
  } catch (e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/users/stats — admin dashboard stats
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const safeCount = async (table) => {
      try {
        const [[r]] = await db.query(`SELECT COUNT(*) AS c FROM ${table}`);
        return r.c;
      } catch(e) { return 0; }
    };
    const safeAvg = async () => {
      try {
        const [[r]] = await db.query('SELECT ROUND(AVG(rating),1) AS avg FROM feedback');
        return r.avg || null;
      } catch(e) { return null; }
    };
    const [ev, us, re, fb, cm, avg] = await Promise.all([
      safeCount('events'), safeCount('users'), safeCount('registrations'),
      safeCount('feedback'), safeCount('contact_messages'), safeAvg()
    ]);
    res.json({
      total_events: ev, total_users: us,
      total_registrations: re, total_feedback: fb,
      total_messages: cm, avg_rating: avg
    });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/users/profile — logged-in user's own profile
router.get('/profile', auth, async (req, res) => {
  try {
    const [r] = await db.query(
      'SELECT user_id, name, email, college, city, role, created_at FROM users WHERE user_id=?',
      [req.user.user_id]
    );
    if (!r.length) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: r[0] });
  } catch (e) { res.status(500).json({ message: 'Server error.' }); }
});

// PUT /api/users/profile — update own profile
router.put('/profile', auth, async (req, res) => {
  const { name, college, city, password } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  try {
    if (password && password.length >= 6) {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET name=?,college=?,city=?,password=? WHERE user_id=?',
        [name.trim(), college||'', city||'', hashed, req.user.user_id]);
    } else {
      await db.query('UPDATE users SET name=?,college=?,city=? WHERE user_id=?',
        [name.trim(), college||'', city||'', req.user.user_id]);
    }
    const [rows] = await db.query(
      'SELECT user_id,name,email,college,city,role FROM users WHERE user_id=?',
      [req.user.user_id]
    );
    res.json({ message: 'Profile updated!', user: rows[0] });
  } catch (e) { res.status(500).json({ message: 'Server error.' }); }
});

// DELETE /api/users/:id — admin: remove a user
router.delete('/:id', auth, adminOnly, async (req, res) => {
  if (parseInt(req.params.id) === req.user.user_id)
    return res.status(400).json({ message: 'Cannot delete your own account.' });
  try {
    await db.query('DELETE FROM users WHERE user_id=?', [req.params.id]);
    res.json({ message: 'User deleted.' });
  } catch (e) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/users/analytics — rich admin analytics
router.get('/analytics', auth, adminOnly, async (req, res) => {
  try {
    const [byCat]     = await db.query(`SELECT e.category, COUNT(r.registration_id) AS count FROM registrations r JOIN events e ON r.event_id=e.event_id GROUP BY e.category ORDER BY count DESC`);
    const [byCity]    = await db.query(`SELECT e.city, COUNT(r.registration_id) AS count FROM registrations r JOIN events e ON r.event_id=e.event_id GROUP BY e.city ORDER BY count DESC`);
    const [byDay]     = await db.query(`SELECT DATE(registered_at) AS day, COUNT(*) AS count FROM registrations WHERE registered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(registered_at) ORDER BY day ASC`);
    const [topEvents] = await db.query(`SELECT e.title, e.category, e.city, e.registered_count, e.capacity, ROUND(e.registered_count/e.capacity*100,0) AS fill_pct FROM events e ORDER BY e.registered_count DESC LIMIT 5`);
    const [byStatus]  = await db.query(`SELECT status, COUNT(*) AS count FROM events GROUP BY status`);
    const [newUsers]  = await db.query(`SELECT DATE(created_at) AS day, COUNT(*) AS count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY day ASC`);
    res.json({ byCat, byCity, byDay, topEvents, byStatus, newUsers });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

module.exports = router;
