const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: function(origin, callback) { callback(null, true); },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/auth',          require('./routes/password'));
app.use('/api/events',        require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/feedback',      require('./routes/feedback'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/contact',       require('./routes/contact'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/upload',        require('./routes/upload'));
app.use('/api/reminders',     require('./routes/reminders'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/waitlist',      require('./routes/waitlist'));
app.use('/api/admin',         require('./routes/email-blast'));
app.use('/api/certificates',  require('./routes/certificates'));

// ─── Stats ────────────────────────────────────────────────────────────────────
const db = require('./config/db');
app.get('/api/stats', async (req, res) => {
  const safeCount = async (table) => {
    try { const [[r]] = await db.query(`SELECT COUNT(*) AS c FROM ${table}`); return r.c; }
    catch(e) { return 0; }
  };
  try {
    const [ev, us, re, fb, cm] = await Promise.all([
      safeCount('events'), safeCount('users'), safeCount('registrations'),
      safeCount('feedback'), safeCount('contact_messages')
    ]);
    res.json({ total_events: ev, total_users: us, total_registrations: re, total_feedback: fb, total_messages: cm });
  } catch(e) { res.status(500).json({ message:'Server error.' }); }
});

app.get('/api/health', (req, res) =>
  res.json({ status:'OK', message:'EventSphere v4.0 running!', timestamp: new Date() })
);

// ─── Admin analytics endpoints ────────────────────────────────────────────────
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const [byCategory] = await db.query(
      `SELECT e.category, COUNT(r.registration_id) AS count
       FROM events e LEFT JOIN registrations r ON e.event_id=r.event_id
       GROUP BY e.category`
    );
    const [byCity] = await db.query(
      `SELECT e.city, COUNT(r.registration_id) AS count
       FROM events e LEFT JOIN registrations r ON e.event_id=r.event_id
       GROUP BY e.city ORDER BY count DESC LIMIT 10`
    );
    const [byDay] = await db.query(
      `SELECT DATE(registered_at) AS day, COUNT(*) AS count
       FROM registrations
       WHERE registered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(registered_at)
       ORDER BY day ASC`
    );
    const [waitlistCounts] = await db.query(
      `SELECT e.event_id, e.title, COUNT(w.id) AS waitlist_count
       FROM events e LEFT JOIN waitlist w ON e.event_id=w.event_id
       GROUP BY e.event_id ORDER BY waitlist_count DESC`
    );
    res.json({ byCategory, byCity, byDay, waitlistCounts });
  } catch(e) { console.error(e); res.status(500).json({ message:'Server error.' }); }
});

// ─── Page routes ──────────────────────────────────────────────────────────────
const pages = ['admin','login','signup','dashboard','events','about','contact','register',
               'success','event-details','profile','404','forgot-password','reset-password','certificate'];
pages.forEach(p => {
  app.get('/'+p, (req, res) =>
    res.sendFile(path.join(__dirname, '../frontend/'+p+'.html'))
  );
});

app.use((req, res) => {
  if (req.path.startsWith('/api/'))
    return res.status(404).json({ message: 'API endpoint not found.' });
  res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
});

// Global error handler — prevents unhandled errors from crashing server
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err.message);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n🚀 EventSphere v4.0 is running!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Website : http://localhost:' + PORT);
  console.log('🔑 Admin   : admin@eventsphere.com / Admin@123');
  console.log('📊 Health  : http://localhost:' + PORT + '/api/health');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let cron = null;
  try { cron = require('node-cron'); } catch(e) {}
  if (cron) {
    const { runReminderJob } = require('./utils/reminder');
    cron.schedule('*/30 * * * *', async () => { await runReminderJob(); });
    runReminderJob().catch(()=>{});
    console.log('⏰ Reminders: Scheduled (every 30 min)');
  }
  const emailOk = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com';
  const razorOk = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_your_key_id';
  console.log('📧 Email   :', emailOk ? '✅ Configured' : '⚠️  Not configured');
  console.log('💳 Razorpay:', razorOk ? '✅ Configured' : '⚠️  Demo mode');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
