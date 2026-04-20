# 🎯 EventSphere — Full Stack Event Management Platform

> Built with Node.js + Express + MySQL + HTML/CSS/JS + AI (Claude API)

---

## 🚀 Quick Start

```bash
cd backend
npm install
# Edit .env with your MySQL password
node server.js
# Open: http://localhost:5000
# Admin: admin@eventsphere.com / Admin@123
```

---

## 📁 Project Structure

```
EventSphere/
├── frontend/          # All HTML pages (no framework needed)
│   ├── index.html     # Homepage
│   ├── events.html    # Browse all events
│   ├── event-details.html  # Event detail + Razorpay payment
│   ├── admin.html     # Full admin panel
│   ├── dashboard.html # User dashboard + QR tickets
│   ├── login.html     # Login page
│   ├── signup.html    # Signup page
│   ├── success.html   # Registration success + QR ticket
│   ├── register.html  # Registration form
│   ├── contact.html   # Contact form
│   └── about.html     # About page
│
└── backend/
    ├── server.js          # Express app entry point
    ├── .env               # Configuration (edit this)
    ├── package.json       # Dependencies
    ├── config/db.js       # MySQL connection pool
    ├── middleware/
    │   ├── auth.js        # JWT verification
    │   └── adminOnly.js   # Admin guard
    ├── routes/
    │   ├── auth.js        # /api/auth/login, /signup
    │   ├── events.js      # /api/events CRUD
    │   ├── registrations.js # /api/registrations + QR
    │   ├── feedback.js    # /api/feedback
    │   ├── users.js       # /api/users + stats + analytics
    │   ├── contact.js     # /api/contact messages
    │   └── payment.js     # /api/payment Razorpay
    ├── utils/
    │   └── email.js       # Nodemailer HTML email
    └── database/
        └── schema.sql     # Run this in MySQL Workbench
```

---

## ⚙️ .env Configuration

```env
# MySQL — REQUIRED
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=eventsphere

# JWT — change in production
JWT_SECRET=eventsphere_super_secret_key_2026

# Email (Gmail) — OPTIONAL, registration still works without it
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=EventSphere <yourgmail@gmail.com>

# Razorpay — OPTIONAL, demo mode works without it
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxx

# Server
PORT=5000
FRONTEND_URL=http://localhost:5000
```

---

## 🛠️ Setup Steps

### Step 1: MySQL Database
1. Open MySQL Workbench
2. File → Open SQL Script → select `backend/database/schema.sql`
3. Press Ctrl+Shift+Enter to run

### Step 2: Backend
```bash
cd backend
npm install          # installs all packages
# Edit .env — set DB_PASSWORD at minimum
node server.js       # starts on http://localhost:5000
```

### Step 3: Open Browser
- Go to http://localhost:5000
- Everything serves from Node.js — no Live Server needed

---

## 🚀 Deploy on Railway (FREE, 5 minutes)

**Netlify CANNOT host this project** because it has a Node.js backend. Use Railway instead — it's free and supports Node.js + MySQL.

### Backend on Railway:
1. Go to railway.app → New Project → Deploy from GitHub
2. Upload/push your code to GitHub first
3. Select the `backend` folder as root
4. Add Environment Variables (copy from .env)
5. Add MySQL plugin → copy the DATABASE_URL
6. Update DB_HOST, DB_USER, DB_PASSWORD, DB_NAME from Railway MySQL

### Frontend:
Since backend serves frontend files via `express.static`, your frontend is automatically live at the same Railway URL. No separate deployment needed.

---

## 📝 npm install — what gets installed

```
bcryptjs    — password hashing
cors        — cross-origin requests
dotenv      — .env file loading
express     — web server
jsonwebtoken — JWT auth tokens
mysql2      — MySQL database driver
nodemailer  — email sending
qrcode      — QR code generation
```

