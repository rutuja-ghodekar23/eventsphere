const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const db       = require('../config/db');
require('dotenv').config();

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required.' });
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email=?', [email.trim().toLowerCase()]);
    // Always return success to prevent email enumeration
    if (!users.length) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
    const user  = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const exp   = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

    // Invalidate previous tokens for this email
    await db.query('UPDATE password_resets SET used=1 WHERE email=? AND used=0', [user.email]);

    await db.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?,?,?)',
      [user.email, token, exp]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password.html?token=${token}`;

    // Use shared email utility
    const { sendPasswordResetEmail } = require('../utils/email');
    const sent = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    if (!sent) {
      // Email not configured — log the link so admin can manually share it
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 Password reset link for', user.email + ':');
      console.log(resetUrl);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch(e) {
    console.error('[ForgotPassword]', e);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  try {
    const [rows] = await db.query(
      'SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ message: 'Reset link has expired or already been used. Please request a new one.' });

    const reset = rows[0];
    const hashed = await bcrypt.hash(password, 10);

    await db.query('UPDATE users SET password=? WHERE email=?', [hashed, reset.email]);
    await db.query('UPDATE password_resets SET used=1 WHERE id=?', [reset.id]);

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch(e) {
    console.error('[ResetPassword]', e);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
