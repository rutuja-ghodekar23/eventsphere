const nodemailer = require('nodemailer');
require('dotenv').config();

// Cache the verified transporter so we don't re-authenticate every email
let _transporter = null;
let _transporterFailed = false;

async function getTransporter() {
  if (_transporterFailed) return null;
  if (_transporter) return _transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || user === 'your_gmail@gmail.com' || !pass) {
    console.log('[Email] Not configured — emails will be skipped.');
    _transporterFailed = true;
    return null;
  }

  // Use explicit SMTP settings for Gmail (more reliable than service:'gmail')
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  try {
    await t.verify();
    console.log('[Email] ✅ Gmail SMTP connected successfully');
    _transporter = t;
    return _transporter;
  } catch (err) {
    console.error('[Email] ❌ Gmail SMTP failed:', err.message);
    console.error('[Email]    Check: EMAIL_USER and EMAIL_PASS in .env');
    console.error('[Email]    Gmail needs an App Password (not your normal password)');
    console.error('[Email]    Create one at: myaccount.google.com → Security → App Passwords');
    _transporterFailed = true;
    return null;
  }
}

// Initialize on startup
getTransporter().catch(() => {});

async function sendMail(options) {
  const t = await getTransporter();
  if (!t) {
    console.log('[Email] Skipped (not configured):', options.subject);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || `EventSphere <${process.env.EMAIL_USER}>`,
      ...options
    });
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    // Reset transporter so next call retries
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      _transporter = null;
    }
    return false;
  }
}

async function sendRegistrationEmail({ to, name, eventTitle, eventDate, venue, city, registrationId, qrDataUrl }) {
  const dateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) : 'Date TBA';
  const timeStr = eventDate ? new Date(eventDate).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '';
  const bookingId = `#ES-${String(registrationId).padStart(6,'0')}`;

  // Convert data URL to Buffer for CID inline attachment (fixes QR in email clients)
  let qrBuffer = null;
  if (qrDataUrl && qrDataUrl.startsWith('data:image/png;base64,')) {
    try {
      qrBuffer = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64');
    } catch(e) { qrBuffer = null; }
  }

  // Use CID reference if we have buffer, otherwise fall back to data URL
  const qrImgTag = qrBuffer
    ? `<img src="cid:qrcode_cid" alt="QR Code" style="width:180px;height:180px;border:4px solid #F5A623;border-radius:12px;padding:6px;background:white;"/>`
    : (qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" style="width:180px;height:180px;border:4px solid #F5A623;border-radius:12px;padding:6px;background:white;"/>` : '');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#F8F9FA;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#F5A623,#E09400);padding:32px 36px;text-align:center;">
        <div style="font-size:32px;margin-bottom:6px;">🎟️</div>
        <div style="font-size:24px;font-weight:800;color:#fff;">EventSphere</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:4px;">Registration Confirmed!</div>
      </div>
      <div style="padding:36px;">
        <h2 style="font-size:22px;font-weight:700;color:#1A1A2E;">Hey ${name}! 🎉</h2>
        <p style="font-size:15px;color:#555;line-height:1.7;">You're officially registered for <strong>${eventTitle}</strong>.</p>
        <div style="background:#FFF8EE;border:1.5px solid #FFE4A0;border-radius:12px;padding:24px;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E09400;margin-bottom:16px;">Event Details</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-size:13px;color:#888;width:110px;">📅 Date</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${dateStr}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#888;">⏰ Time</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${timeStr}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#888;">📍 Venue</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${venue}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#888;">🏙️ City</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${city}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#888;">🎫 Booking</td><td style="padding:8px 0;font-size:15px;font-weight:700;color:#F5A623;">${bookingId}</td></tr>
          </table>
        </div>
        ${(qrBuffer || qrDataUrl) ? `
        <div style="text-align:center;margin-bottom:28px;background:#F9F9F9;border-radius:12px;padding:24px;">
          <div style="font-size:14px;font-weight:700;color:#1A1A2E;margin-bottom:14px;">🔳 Your Entry QR Code</div>
          ${qrImgTag}
          <div style="font-size:12px;color:#888;margin-top:10px;">Show this at the event entrance</div>
        </div>` : ''}
        <div style="background:#E8F8EE;border-radius:10px;padding:16px;margin-bottom:24px;font-size:13.5px;color:#166534;">
          💡 <strong>Remember:</strong> You'll receive reminder emails 7 days, 1 day, and 2 hours before the event.
        </div>
      </div>
      <div style="background:#F8F9FA;border-top:1px solid #E8E8E8;padding:20px 36px;text-align:center;">
        <div style="font-size:12px;color:#aaa;">© 2026 EventSphere · You received this because you registered for an event.</div>
      </div>
    </div>
  </body></html>`;

  // Build mail options — attach QR as inline CID image for proper email rendering
  const mailOpts = {
    to,
    subject: `🎟️ You're in! Registration confirmed for ${eventTitle}`,
    html
  };
  if (qrBuffer) {
    mailOpts.attachments = [{
      filename: 'qrcode.png',
      content: qrBuffer,
      cid: 'qrcode_cid',
      contentType: 'image/png'
    }];
  }

  return sendMail(mailOpts);
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#F8F9FA;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#F5A623,#E09400);padding:28px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">EventSphere</h1>
        <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:4px;">Password Reset Request</div>
      </div>
      <div style="padding:36px;">
        <h2 style="color:#1A1A2E;">Reset Your Password</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;">Hi ${name}, click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#F5A623;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Reset Password →
          </a>
        </div>
        <p style="color:#999;font-size:12px;text-align:center;">If you did not request this, you can safely ignore this email.</p>
        <div style="background:#FFF8EE;border-radius:8px;padding:14px;margin-top:16px;">
          <p style="margin:0;font-size:12px;color:#888;">Or copy this link:<br><a href="${resetUrl}" style="color:#F5A623;word-break:break-all;">${resetUrl}</a></p>
        </div>
      </div>
    </div>
  </body></html>`;

  return sendMail({ to, subject: '🔐 Reset your EventSphere password', html });
}

module.exports = { sendRegistrationEmail, sendPasswordResetEmail };
