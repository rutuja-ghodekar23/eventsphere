const jwt = require('jsonwebtoken');
const db  = require('../config/db');
require('dotenv').config();

module.exports = async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = auth.split(' ')[1];

  // ── Demo token support ─────────────────────────────────────────────
  if (token === 'demo-admin-token') {
    req.user = { user_id: 1, name: 'Admin User', email: 'admin@eventsphere.com', role: 'admin' };
    return next();
  }
  if (token.startsWith('demo-user-token-')) {
    const uid = parseInt(token.replace('demo-user-token-', '')) || 999;
    req.user = { user_id: uid, name: 'Demo User', email: 'demo@eventsphere.com', role: 'user' };
    return next();
  }
  // ────────────────────────────────────────────────────────────────────

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists in DB (catches stale tokens after DB reset)
    try {
      const [rows] = await db.query('SELECT user_id, name, email, role, city, college FROM users WHERE user_id=?', [decoded.user_id]);
      if (!rows.length) {
        return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'USER_NOT_FOUND' });
      }
      // Use fresh DB data (in case role/name changed)
      req.user = rows[0];
    } catch (dbErr) {
      // If DB is down, fall back to JWT data
      console.warn('[Auth] DB check failed, using JWT data:', dbErr.message);
      req.user = decoded;
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};
