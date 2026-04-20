# EventSphere v4.0 — Setup Guide

## Quick Start

```bash
# 1. Clone / unzip the project
cd EventSphere4/backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env   # edit with your DB / email credentials

# 4. Create the database (first time)
# Open MySQL Workbench → File → Open SQL Script → schema.sql → Ctrl+Shift+Enter

# 5. Run the server
npm start
# Visit: http://localhost:5000
```

---

## Phase 1 — Updating an Existing v3 Database

If you already have EventSphere v3 running, **do NOT drop the database**. Run only the ALTER statements:

1. Open MySQL Workbench and connect to your server
2. Press **Ctrl+R** to refresh the schema browser
3. Open a new query tab and paste:

```sql
USE eventsphere;

ALTER TABLE events ADD COLUMN IF NOT EXISTS tags VARCHAR(300) DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS skills_required VARCHAR(300) DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid TINYINT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_fee INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_link VARCHAR(500) DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_embed TEXT;

CREATE TABLE IF NOT EXISTS waitlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, event_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notified TINYINT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  UNIQUE KEY unique_wait (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150), token VARCHAR(100),
  expires_at DATETIME, used TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_blasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT, subject VARCHAR(200),
  message TEXT, sent_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

4. Press **Ctrl+Shift+Enter** to run all statements
5. Press **Ctrl+R** again to verify new tables appear in the schema browser

---

## Instant Data Scraper → CSV Import Workflow

Use this to scrape events from Unstop, Devfolio, etc. and import them into EventSphere.

### Step 1 — Install the Extension
- Go to Chrome Web Store and search **"Instant Data Scraper"**
- Click **Add to Chrome**

### Step 2 — Scrape Events
1. Go to `https://unstop.com/hackathons` or `https://devfolio.co/hackathons`
2. Click the **Instant Data Scraper** icon in the Chrome toolbar
3. Click **"Start Crawling"** — it auto-detects event listings
4. Let it crawl through all pages (click "Crawl next page" or enable auto)
5. Click **"Download CSV"** — save the file

### Step 3 — Import into EventSphere
1. Log in as Admin → go to **Admin Panel**
2. Click **Events** in the sidebar
3. Click the **📂 Import CSV** button at the top of the events list
4. Select the downloaded CSV file
5. A **preview modal** shows the first 5 rows and detected column count
6. Click **✅ Import All N Events** to confirm
7. A toast notification shows: `✅ Imported N events. Skipped M.`

> The importer auto-maps messy column names like "Event Name" → title, "Location" → city, "URL" → external_link, etc. Rows missing a title are skipped automatically.

---

## Environment Variables (.env)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=eventsphere
JWT_SECRET=your_jwt_secret_here
PORT=5000

# Email (Gmail — enable App Password in Google Account settings)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=EventSphere <your_gmail@gmail.com>

# Frontend URL (used in reset-password emails)
FRONTEND_URL=http://localhost:5000

# Razorpay (optional — for paid events)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_secret
```

---

## Free MySQL Hosting Options

| Provider | Free Tier | Notes |
|---|---|---|
| **Railway** | 500MB, $5 credit/mo | Easiest setup, one-click MySQL |
| **PlanetScale** | 5GB, 1B row reads/mo | Serverless MySQL, excellent DX |
| **Clever Cloud** | 256MB MySQL | EU-based, good free plan |
| **Aiven** | 5GB for 30 days | Then paid |
| **Supabase** | PostgreSQL (not MySQL) | Great if you migrate schema |

**Railway (recommended):**
```bash
# After creating a Railway MySQL service, get the connection string:
# MYSQL_URL=mysql://user:pass@host:port/dbname
# Set individual env vars from the Railway dashboard → Variables tab
```

---

## Verifying DB Updates in MySQL Workbench

1. Connect to your MySQL server
2. In the **Navigator** panel (left side), right-click your schema → **Refresh All**  
   Or press **Ctrl+R**
3. Expand **Tables** — you should see: `waitlist`, `password_resets`, `email_blasts`
4. Expand `events` → **Columns** — you should see the new v4 columns:  
   `tags`, `skills_required`, `is_paid`, `registration_fee`, `external_link`, `map_embed`

To verify data after import:
```sql
SELECT event_id, title, tags, is_paid, external_link 
FROM events 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## New v4 Features Summary

| Feature | Where |
|---|---|
| Waitlist (auto-join when full) | Event Details page |
| Password Reset (email link) | Login → Forgot Password |
| Email Blast (admin → all users) | Admin → Messages panel |
| Certificates (completed events) | Dashboard → Past Events |
| CSV Import with preview | Admin → Events → Import CSV |
| Tags & Skills on events | Event Details + Admin form |
| Paid events + Razorpay | Event Details (is_paid=1) |
| Map embed | Event Details (map_embed field) |
| External registration link | Event Details |
| Chatbot (floating) | Index, Events, Event Details, Dashboard |
| PWA / installable app | All pages (manifest + service worker) |
| Analytics charts (Chart.js) | Admin → Analytics panel |

---

## Default Admin Credentials

```
Email:    admin@eventsphere.com
Password: Admin@123
```

---

## Running in Production

```bash
# Install PM2
npm install -g pm2

# Start with PM2
cd backend
pm2 start server.js --name eventsphere

# Auto-restart on reboot
pm2 startup
pm2 save
```
