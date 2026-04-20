const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const db        = require('../config/db');

// GET /api/reminders/upcoming — admin: events in next 8 days needing attention
router.get('/upcoming', auth, adminOnly, async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.event_id, e.title, e.date, e.city, e.venue,
             COUNT(r.registration_id)   AS total_registrations,
             TIMESTAMPDIFF(HOUR, NOW(), e.date) AS hours_until,
             SUM(r.reminder_7d_sent)    AS sent_7d,
             SUM(r.reminder_1d_sent)    AS sent_1d,
             SUM(r.reminder_2h_sent)    AS sent_2h
      FROM events e
      LEFT JOIN registrations r ON e.event_id = r.event_id
      WHERE e.status = 'Upcoming'
        AND e.date > NOW()
        AND e.date <= DATE_ADD(NOW(), INTERVAL 8 DAY)
      GROUP BY e.event_id
      ORDER BY e.date ASC`
    );
    res.json({ events, total: events.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/reminders/send — manually blast a reminder for one event (event_id from body or URL param)
router.post('/send', auth, adminOnly, async (req, res) => {
  const event_id = req.body.event_id;
  if (!event_id) {
    return res.status(400).json({ message: 'event_id is required in request body.' });
  }
  const isEmailConfigured =
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_gmail_app_password';

  if (!isEmailConfigured) {
    return res.status(400).json({
      message: 'Email not configured. Set EMAIL_USER and EMAIL_PASS in .env first.'
    });
  }

  try {
    const { sendReminderEmail } = require('../utils/reminder');

    const [registrations] = await db.query(`
      SELECT r.registration_id, u.name, u.email,
             e.title, e.date, e.venue, e.city,
             CONCAT('ES-', LPAD(r.registration_id, 6, '0')) AS booking_id,
             TIMESTAMPDIFF(HOUR, NOW(), e.date) AS hours_until
      FROM registrations r
      JOIN users u  ON r.user_id  = u.user_id
      JOIN events e ON r.event_id = e.event_id
      WHERE r.event_id = ?
        AND e.status = 'Upcoming'
        AND e.date > NOW()`,
      [event_id]
    );

    if (!registrations.length) {
      return res.json({ message: 'No registrations found for this event.', sent: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const reg of registrations) {
      try {
        await sendReminderEmail({
          to:         reg.email,
          name:       reg.name,
          eventTitle: reg.title,
          eventDate:  reg.date,
          venue:      reg.venue,
          city:       reg.city,
          bookingId:  reg.booking_id,
          hoursUntil: reg.hours_until || 24
        });
        sent++;
      } catch (emailErr) {
        console.warn(`Email failed for ${reg.email}:`, emailErr.message);
        failed++;
      }
    }

    res.json({
      message: `Sent ${sent} reminder email(s)${failed ? `, ${failed} failed` : ''}.`,
      sent,
      failed,
      total: registrations.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error: ' + e.message });
  }
});

// POST /api/reminders/send/:event_id — URL-param alias (used by admin frontend)
router.post('/send/:event_id', auth, adminOnly, async (req, res) => {
  req.body = req.body || {};
  req.body.event_id = req.params.event_id;
  // Delegate to the body-based handler by re-running the same logic
  const event_id = req.params.event_id;
  const isEmailConfigured =
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_gmail_app_password';

  if (!isEmailConfigured) {
    return res.status(400).json({
      message: 'Email not configured. Set EMAIL_USER and EMAIL_PASS in .env first.'
    });
  }

  try {
    const { sendReminderEmail } = require('../utils/reminder');

    const [registrations] = await db.query(`
      SELECT r.registration_id, u.name, u.email,
             e.title, e.date, e.venue, e.city,
             CONCAT('ES-', LPAD(r.registration_id, 6, '0')) AS booking_id,
             TIMESTAMPDIFF(HOUR, NOW(), e.date) AS hours_until
      FROM registrations r
      JOIN users u  ON r.user_id  = u.user_id
      JOIN events e ON r.event_id = e.event_id
      WHERE r.event_id = ?
        AND e.status = 'Upcoming'
        AND e.date > NOW()`,
      [event_id]
    );

    if (!registrations.length) {
      return res.json({ message: 'No registrations found for this event.', sent: 0 });
    }

    let sent = 0, failed = 0;
    for (const reg of registrations) {
      try {
        await sendReminderEmail({
          to:         reg.email,
          name:       reg.name,
          eventTitle: reg.title,
          eventDate:  reg.date,
          venue:      reg.venue,
          city:       reg.city,
          bookingId:  reg.booking_id,
          hoursUntil: reg.hours_until || 24
        });
        sent++;
      } catch (emailErr) {
        console.warn(`Email failed for ${reg.email}:`, emailErr.message);
        failed++;
      }
    }

    res.json({
      message: `Sent ${sent} reminder email(s)${failed ? `, ${failed} failed` : ''}.`,
      sent, failed, total: registrations.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error: ' + e.message });
  }
});

module.exports = router;
