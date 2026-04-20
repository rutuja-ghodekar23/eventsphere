const db         = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendReminderEmail({ to, name, eventTitle, eventDate, venue, city, bookingId, hoursUntil }) {
  const dateStr = new Date(eventDate).toLocaleDateString('en-IN', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
  const timeStr = new Date(eventDate).toLocaleTimeString('en-IN', {
    hour:'2-digit', minute:'2-digit'
  });

  const urgencyColor = hoursUntil <= 2 ? '#DC2626' : hoursUntil <= 24 ? '#F5A623' : '#3B82F6';
  const urgencyText  = hoursUntil <= 2 ? '⚡ Starting very soon!'
                     : hoursUntil <= 24 ? '🔔 Event is tomorrow!'
                     : `📅 Event in ${Math.round(hoursUntil/24)} days`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#F8F9FA;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:${urgencyColor};padding:28px 36px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">⏰</div>
        <div style="font-size:22px;font-weight:800;color:#fff;">Event Reminder</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:6px;">${urgencyText}</div>
      </div>
      <div style="padding:36px;">
        <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:6px;">Hi ${name}! 👋</h2>
        <p style="font-size:15px;color:#555;line-height:1.7;margin-bottom:24px;">
          Just a friendly reminder — <strong>${eventTitle}</strong> is coming up. Get ready!
        </p>
        <div style="background:#FFF8EE;border:1.5px solid #FFE4A0;border-radius:12px;padding:24px;margin-bottom:24px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E09400;margin-bottom:14px;">Event Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:7px 0;font-size:13px;color:#888;width:110px;">📅 Date</td><td style="padding:7px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${dateStr}</td></tr>
            <tr><td style="padding:7px 0;font-size:13px;color:#888;">⏰ Time</td><td style="padding:7px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${timeStr}</td></tr>
            <tr><td style="padding:7px 0;font-size:13px;color:#888;">📍 Venue</td><td style="padding:7px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${venue}</td></tr>
            <tr><td style="padding:7px 0;font-size:13px;color:#888;">🏙️ City</td><td style="padding:7px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${city}</td></tr>
            <tr><td style="padding:7px 0;font-size:13px;color:#888;">🎫 Booking</td><td style="padding:7px 0;font-size:15px;font-weight:700;color:#F5A623;">${bookingId}</td></tr>
          </table>
        </div>
        <div style="background:#F0F9FF;border-radius:10px;padding:16px;margin-bottom:24px;font-size:13.5px;color:#0369a1;">
          💡 <strong>Remember to bring:</strong> Open your EventSphere dashboard to show your QR code ticket at the entrance.
        </div>
        <div style="text-align:center;">
          <a href="${process.env.FRONTEND_URL||'http://localhost:5000'}/dashboard.html"
             style="display:inline-block;background:${urgencyColor};color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;">
            View My Ticket →
          </a>
        </div>
      </div>
      <div style="background:#F8F9FA;border-top:1px solid #E8E8E8;padding:18px 36px;text-align:center;">
        <div style="font-size:12px;color:#aaa;">© 2026 EventSphere · You received this because you registered for this event.</div>
      </div>
    </div>
  </body></html>`;

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'EventSphere <noreply@eventsphere.com>',
    to,
    subject: `⏰ ${urgencyText.replace(/[⚡🔔📅]/g,'').trim()} — ${eventTitle}`,
    html
  });
}

/**
 * Main reminder job — runs via cron every 30 minutes
 * Sends reminders at 7 days, 1 day, 2 hours — each sent only once per registration
 */
async function runReminderJob() {
  const isEmailConfigured = process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your_gmail_app_password';

  if (!isEmailConfigured) return;

  const windows = [
    { hours: 168, col: 'reminder_7d_sent', label: '7 days'  },
    { hours: 24,  col: 'reminder_1d_sent', label: '1 day'   },
    { hours: 2,   col: 'reminder_2h_sent', label: '2 hours' },
  ];

  for (const win of windows) {
    try {
      // Get registrations where:
      // - Event is upcoming and in the reminder window
      // - This specific reminder has NOT been sent yet
      const [rows] = await db.query(
        `SELECT r.registration_id, r.user_id, u.name, u.email,
                e.event_id, e.title, e.date, e.venue, e.city,
                CONCAT('ES-', LPAD(r.registration_id, 6, '0')) AS booking_id
         FROM registrations r
         JOIN users u  ON r.user_id  = u.user_id
         JOIN events e ON r.event_id = e.event_id
         WHERE e.status = 'Upcoming'
           AND e.date > NOW()
           AND TIMESTAMPDIFF(MINUTE, NOW(), e.date) BETWEEN ? AND ?
           AND r.${win.col} = 0`,
        [win.hours * 60 - 30, win.hours * 60 + 30]
      );

      for (const reg of rows) {
        try {
          await sendReminderEmail({
            to:         reg.email,
            name:       reg.name,
            eventTitle: reg.title,
            eventDate:  reg.date,
            venue:      reg.venue,
            city:       reg.city,
            bookingId:  reg.booking_id,
            hoursUntil: win.hours
          });
          // Mark as sent so we don't send again
          await db.query(
            `UPDATE registrations SET ${win.col}=1 WHERE registration_id=?`,
            [reg.registration_id]
          );
          console.log(`📧 Reminder (${win.label}) → ${reg.email} for "${reg.title}"`);
        } catch (e) {
          console.warn(`⚠️  Email failed for ${reg.email}:`, e.message);
        }
      }
    } catch (e) {
      console.error(`❌ Reminder job error (${win.label}):`, e.message);
    }
  }
}

module.exports = { runReminderJob, sendReminderEmail };
