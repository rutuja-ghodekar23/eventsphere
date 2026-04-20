const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'eventsphere',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  enableKeepAlive:  true,
  keepAliveInitialDelay: 0
});

// Test connection on startup
pool.getConnection((err, conn) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in backend/.env');
    return;
  }
  console.log('✅ MySQL connected successfully');
  conn.release();
});

module.exports = pool.promise();
