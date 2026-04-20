const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
require('dotenv').config();

// POST /api/admin/email-blast
router.post('/email-blast', auth, adminOnly, async (req, res) => {
  const { subject, message, city } = req.body;
  if (!subject || !message) return res.status(400).json({ message: 'Subject and message required.' });

  try {
    let q = 'SELECT user_id, name, email FROM users WHERE role="user"';
    const params = [];
    if (city && city !== 'all') {
      q += ' AND city=?';
      params.push(city);
    }
    const [users] = await db.query(q, params);
    if (!users.length) return res.status(404).json({ message: 'No users found.' });

    const [blast] = await db.query(
      'INSERT INTO email_blasts (admin_id, subject, message, sent_count) VALUES (?,?,?,?)',
      [req.user.user_id, subject, message, 0]
    );
    const blastId = blast.insertId;

    // Send asynchronously — respond immediately
    res.json({ message: `Sending to ${users.length} users...`, blast_id: blastId, count: users.length });

    if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com') {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      let sent = 0;
      for (const user of users) {
        try {
          const html = `<div style="font-family:sans-serif;max-width:580px;margin:auto;">
            <div style="background:linear-gradient(135deg,#F5A623,#E09400);padding:28px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;">EventSphere</h1>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #e8e8e8;border-radius:0 0 12px 12px;">
              <p style="color:#555;line-height:1.7;">Hi ${user.name},</p>
              <div style="color:#333;line-height:1.8;white-space:pre-wrap;">${message}</div>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
              <p style="color:#aaa;font-size:12px;">© 2026 EventSphere. You're receiving this as a registered user.</p>
            </div>
          </div>`;
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || `EventSphere <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject,
            html
          });
          sent++;
        } catch(e) {
          console.warn(`Blast email failed for ${user.email}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 100)); // 100ms delay
      }
      await db.query('UPDATE email_blasts SET sent_count=? WHERE id=?', [sent, blastId]);
    } else {
      console.log(`[Email Blast] Email not configured — would send to ${users.length} users:`, subject);
      await db.query('UPDATE email_blasts SET sent_count=? WHERE id=?', [users.length, blastId]);
    }
  } catch(e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/admin/email-blasts — history
router.get('/email-blasts', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT eb.*, u.name AS admin_name
       FROM email_blasts eb
       LEFT JOIN users u ON eb.admin_id = u.user_id
       ORDER BY eb.created_at DESC LIMIT 50`
    );
    res.json({ blasts: rows });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

module.exports = router;
