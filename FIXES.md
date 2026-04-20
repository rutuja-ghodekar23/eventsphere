# EventSphere — Bug Fixes & Production Changes

## 🔴 Fix 1: DB_PASSWORD quoting in .env (ROOT CAUSE of most failures)
**File:** `backend/.env`

dotenv does NOT strip surrounding quotes — they were passed literally to MySQL, causing:
- Admin panel "Loading events…" spinner never resolving
- Signup showing error  
- Chatbot returning empty results

```diff
- DB_PASSWORD="rutuja23@#"
+ DB_PASSWORD=rutuja23@#
```

---

## 🟠 Fix 2: Free / Paid badges on Event Cards
**File:** `frontend/events.html`

Added green ✅ Free and purple 💜 Paid badges in `renderCards()`.
Fixed MySQL integer comparison — `is_paid` returns `0`/`1`, not `true`/`false`.

```js
// Before (broken — MySQL returns integer 0, not false)
evs.filter(e => !e.is_paid && !e.registration_fee)

// After (correct)
evs.filter(e => !e.is_paid && !(e.registration_fee > 0))
```

Added CSS:
```css
.badge-free { background:#16a34a; color:#fff !important; }
.badge-paid { background:#7c3aed; color:#fff !important; }
```

---

## 🟠 Fix 3: Chatbot — stops working after login/registration
**File:** `frontend/chatbot.js`

**Root cause:** `greeted = true` was set on first open, so `fetchEvents()` never re-ran. After a user signed up/logged in, the chatbot kept using stale empty EVENTS array.

```js
// Before — only fetches once
if (isOpen && !greeted) { greeted = true; fetchEvents().then(showGreeting); }

// After — re-fetches events on every open (cheap, cached by browser)
if (isOpen) {
  fetchEvents().then(() => {
    if (!greeted) { greeted = true; showGreeting(); }
  });
}
```

Also fixed city query fallback when events are still loading.

---

## 🟠 Fix 4: Chatbot — "events in pune" returned wrong response
**File:** `frontend/chatbot.js`

When EVENTS array was empty (due to DB password bug), the city branch had no fallback
and fell through to the generic AI prompt. Fixed with explicit "still loading" message.

---

## 🟠 Fix 5: Contact Page — "View on Maps" not working
**File:** `frontend/contact.html`

`<span>` has no default click action. Changed to proper `<a>` tag.

```html
<!-- Before -->
<span class="info-link" style="cursor:pointer">View on Maps …</span>

<!-- After -->
<a href="https://www.google.com/maps/search/?api=1&query=123+Innovation+Drive+Tech+Park+Pune"
   target="_blank" rel="noopener" class="info-link">View on Maps …</a>
```

---

## 🟠 Fix 6: Admin Panel — BURL detection race condition
**File:** `frontend/admin.html`

The `tId` variable was captured incorrectly inside the loop closure.
Each `setTimeout` could abort the wrong `AbortController`.

Also added: friendly warning banner when backend is not detected,
instead of silently showing "Loading events…" forever.

---

## 🟠 Fix 7: event-details.html — Price uses hardcoded demo values
**File:** `frontend/event-details.html`

`getPriceForEvent()` was using hardcoded demo prices instead of actual DB `is_paid` / `registration_fee` fields.

```js
// Before — ignored DB data
function getPriceForEvent(ev) {
  if (ev.event_id <= 5) return 0;
  return priceMap[ev.category] || 199;
}

// After — uses actual DB fields
function getPriceForEvent(ev) {
  if (ev.is_paid == 1 && ev.registration_fee > 0) return ev.registration_fee;
  if (ev.is_paid == 1) return priceMap[ev.category] || 199;
  return 0;
}
```

Also fixed stale `localStorage` cache for already-registered check (used string comparison for event_id).

---

## 🟠 Fix 8: Login & Signup — BURL not persisted between pages
**Files:** `frontend/login.html`, `frontend/signup.html`

Login was recalculating BURL from scratch instead of using the stored `backendURL`.
Signup now probes backend on page load so BURL is ready before the form submits.

---

## 🟢 Fix 9: Backend — Global error handler + crash prevention
**File:** `backend/server.js`

Added Express global error middleware and Node.js unhandled rejection handlers.
This prevents one bad API call from crashing the entire server.

---

## 🚀 How to Run

```bash
# 1. Import database
# Open MySQL Workbench → run backend/database/schema.sql

# 2. Start backend
cd backend
npm install
node server.js

# 3. Open frontend
# Visit: http://localhost:5000

# Admin login
# Email: admin@eventsphere.com
# Pass:  Admin@123
```

## ⚙️ Email Setup (for forgot password)
Already configured in `.env`:
```
EMAIL_USER=rutujaghodekar23@gmail.com
EMAIL_PASS=jjjmbqhxgjryxahs   ← Gmail App Password (16 chars)
```
If the app password expires, generate a new one:
Google Account → Security → 2-Step Verification → App Passwords
