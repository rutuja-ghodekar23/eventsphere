const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const multer    = require('multer');
const upload    = multer({ storage: multer.memoryStorage() });

let parseCSV = null;
try { parseCSV = require('csv-parse/sync').parse; } catch(e) {}

// GET /api/events
router.get('/', async (req, res) => {
  try {
    let q = 'SELECT * FROM events WHERE 1=1';
    const params = [];
    if (req.query.city)     { q += ' AND city=?';     params.push(req.query.city); }
    if (req.query.category) { q += ' AND category=?'; params.push(req.query.category); }
    if (req.query.status)   { q += ' AND status=?';   params.push(req.query.status); }
    q += req.query.trending ? ' ORDER BY registered_count DESC, date ASC' : ' ORDER BY date ASC';
    if (req.query.limit) { q += ' LIMIT ?'; params.push(parseInt(req.query.limit)); }
    const [events] = await db.query(q, params);
    res.json({ events, total: events.length });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

// ── CSV import routes MUST be before /:id ─────────────────────────────────────

// POST /api/events/import-csv/preview
router.post('/import-csv/preview', auth, adminOnly, upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file required.' });
  if (!parseCSV) return res.status(501).json({ message: 'csv-parse not installed. Run: npm install csv-parse' });
  try {
    const raw = req.file.buffer.toString('utf-8');
    const records = parseCSV(raw, { columns:true, skip_empty_lines:true, trim:true, bom:true, relax_column_count:true });
    res.json({ total: records.length, columns: records.length ? Object.keys(records[0]) : [], preview: records.slice(0,5) });
  } catch(e) { res.status(400).json({ message: 'Failed to parse CSV: ' + e.message }); }
});

// POST /api/events/import-csv — supports ANY CSV format including Instant Data Scraper
router.post('/import-csv', auth, adminOnly, upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file required.' });
  if (!parseCSV) return res.status(501).json({ message: 'csv-parse not installed. Run: npm install csv-parse' });

  let records = [];
  try {
    const raw = req.file.buffer.toString('utf-8');
    records = parseCSV(raw, { columns:true, skip_empty_lines:true, trim:true, bom:true, relax_column_count:true });
  } catch(e) { return res.status(400).json({ message: 'Failed to parse CSV: ' + e.message }); }

  if (!records.length) return res.json({ imported:0, skipped:0, errors:[], message:'CSV is empty.' });

  // Log column names to help debug
  console.log('[CSV Import] Columns detected:', Object.keys(records[0]));

  const VALID_CATS = ['Technical','Cultural','Sports','Workshop','Seminar','Hackathon'];
  let imported=0, skipped=0;
  const errors=[];

  for (let i=0; i<records.length; i++) {
    const row=records[i], rowNum=i+2;
    try {
      // ── SMART FIELD DETECTION ──────────────────────────────────────────────
      // Supports: standard CSVs, Instant Data Scraper (Unstop/Devfolio/HackerEarth)
      // Instant Data Scraper from Unstop typically has:
      //   ITEM HREF, DOUBLE-WRAP (event name), SINGLE-WRAP (org), NG-STAR-INSERTED, LOCATION_TEXT etc.

      const allKeys = Object.keys(row);

      // Helper: pick first non-empty value from any matching key (fuzzy match)
      const get = (...candidates) => {
        for (const c of candidates) {
          // Exact match first
          if (row[c] !== undefined && String(row[c]).trim()) return String(row[c]).trim();
          // Fuzzy: key contains candidate string
          const fuzzyKey = allKeys.find(k => k.toLowerCase().includes(c.toLowerCase()) && String(row[k]).trim());
          if (fuzzyKey) return String(row[fuzzyKey]).trim();
        }
        return '';
      };

      // ── Title ──────────────────────────────────────────────────────────────
      // Instant Data Scraper: title is often in DOUBLE-WRAP, SINGLE-WRAP, or NG-STAR-INSERTED
      // Standard: Event Name, Title, Event Title, Name
      let title = get('Event Name','Event Title','Title','name','title','DOUBLE-WRAP','double-wrap','double_wrap');
      
      // If still empty, try any column that looks like a title (longer text, not a URL)
      if (!title) {
        for (const k of allKeys) {
          const v = String(row[k]||'').trim();
          if (v && v.length > 5 && v.length < 200 && !v.startsWith('http') && !/^\d+$/.test(v)) {
            title = v; break;
          }
        }
      }
      if (!title) { skipped++; errors.push(`Row ${rowNum}: No title found`); continue; }

      // ── External Link ──────────────────────────────────────────────────────
      // Instant Data Scraper: ITEM HREF is usually the event URL
      const extLink = get('ITEM HREF','item href','item_href','URL','Link','href','url','Registration Link','register_url') || '';

      // ── Description / Organization ─────────────────────────────────────────
      const desc = get('Description','About','desc','description','Details','SINGLE-WRAP','single-wrap','single_wrap','NG-STAR-INSERTED','ng-star-inserted','Organization','Organizer') || '';

      // ── Date ──────────────────────────────────────────────────────────────
      let rawDate = get('Date','Event Date','date','Start Date','start_date','Deadline','deadline','Last Date','Registration Deadline');
      let parsedDate = null;
      if (rawDate) {
        // Handle formats: "15 Jun 2026", "2026-06-15", "Jun 15, 2026", "15/06/2026"
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString().slice(0,19).replace('T',' ');
      }

      // ── Location / City ────────────────────────────────────────────────────
      // Instant Data Scraper: LOCATION_TEXT or similar
      let locationRaw = get('Location','City','Place','city','location','LOCATION','location_text','LOCATION_TEXT','venue','Venue','Place Name');
      
      // Try any key containing "location" or "place"
      if (!locationRaw) {
        const locKey = allKeys.find(k => /location|place|city|venue/i.test(k) && String(row[k]||'').trim());
        if (locKey) locationRaw = String(row[locKey]).trim();
      }

      // Map known Indian cities from location string
      const CITIES = ['Pune','Mumbai','Delhi','Bangalore','Bengaluru','Nagpur','Chennai','Hyderabad','Kolkata','Ahmedabad','Jaipur','Mysore','Online'];
      let city = 'India';
      let venue = '';
      if (locationRaw) {
        venue = locationRaw.slice(0,150);
        // Extract city from location string
        const foundCity = CITIES.find(c => locationRaw.toLowerCase().includes(c.toLowerCase()));
        if (foundCity) city = foundCity === 'Bengaluru' ? 'Bangalore' : foundCity;
        else if (/online|virtual|remote/i.test(locationRaw)) city = 'Online';
        else city = locationRaw.split(',')[0].trim().slice(0,50) || 'India';
      }

      // ── Category ──────────────────────────────────────────────────────────
      const catRaw = get('Type','Category','category','Event Type','Track','Domain') || '';
      let category = VALID_CATS.find(c => c.toLowerCase() === catRaw.toLowerCase()) || '';
      
      // Infer from title/description if not found
      if (!category) {
        const combined = (title+' '+desc+' '+catRaw).toLowerCase();
        if (/hackathon|hack/.test(combined)) category = 'Hackathon';
        else if (/workshop|bootcamp|training/.test(combined)) category = 'Workshop';
        else if (/seminar|talk|lecture|webinar/.test(combined)) category = 'Seminar';
        else if (/sport|game|tournament|cricket|football/.test(combined)) category = 'Sports';
        else if (/cultural|fest|dance|music|art/.test(combined)) category = 'Cultural';
        else category = 'Technical';
      }

      // ── Capacity ──────────────────────────────────────────────────────────
      const capRaw = get('Capacity','capacity','Max Attendees','Team Size','max_participants','Seats');
      // Handle team size like "1-2", "1 - 4" → use max*20 as capacity estimate
      let capacity = 100;
      if (capRaw) {
        const nums = capRaw.match(/\d+/g);
        if (nums && nums.length >= 2) capacity = parseInt(nums[nums.length-1]) * 25;
        else if (nums) capacity = parseInt(nums[0]) || 100;
      }
      capacity = Math.max(50, Math.min(capacity, 5000));

      // ── Tags / Skills ──────────────────────────────────────────────────────
      const tags     = get('Tags','Skills','tags','Keywords','tech_stack','Technologies').slice(0,300) || '';
      const skills   = get('Skills Required','skills_required','Requirements','prerequisites').slice(0,300) || '';

      // ── Paid/Free ──────────────────────────────────────────────────────────
      const isPaidRaw = get('Paid','Fee','is_paid','IsPaid','Prize','prize','Registration Fee');
      const isPaid    = ['1','yes','true','paid'].includes((isPaidRaw||'').toLowerCase()) ? 1 : 0;
      const regFee    = parseInt(get('Fee','Price','Amount','Cost','registration_fee')) || 0;

      // ── Image ──────────────────────────────────────────────────────────────
      const imgUrl = get('Image','image_url','Image URL','Photo','thumbnail','img').slice(0,500) || '';

      // ── Insert into DB ────────────────────────────────────────────────────
      await db.query(
        `INSERT INTO events 
         (title,description,category,status,date,venue,city,capacity,image_url,
          tags,skills_required,is_paid,registration_fee,external_link,map_embed)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [title.slice(0,150), desc.slice(0,500), category, 'Upcoming', parsedDate,
         venue.slice(0,150), city.slice(0,50), capacity, imgUrl,
         tags, skills, isPaid, regFee, extLink.slice(0,500), '']
      );
      imported++;
    } catch(e) {
      skipped++;
      if (errors.length<10) errors.push(`Row ${rowNum}: ${e.message}`);
    }
  }

  console.log(`[CSV Import] Done: ${imported} imported, ${skipped} skipped`);
  res.json({ imported, skipped, errors, message: `✅ Imported ${imported} event(s). Skipped ${skipped}.` });
});

// POST /api/events (create)
router.post('/', auth, adminOnly, async (req, res) => {
  const { title, description, category, status, date, venue, city, capacity, image_url,
          tags, skills_required, is_paid, registration_fee, external_link, map_embed } = req.body;
  if (!title || !category || !city)
    return res.status(400).json({ message: 'Title, category and city required.' });
  try {
    const [r] = await db.query(
      'INSERT INTO events (title,description,category,status,date,venue,city,capacity,image_url,tags,skills_required,is_paid,registration_fee,external_link,map_embed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [title, description||'', category, status||'Upcoming', date||null, venue||'', city,
       capacity||100, image_url||'', tags||'', skills_required||'',
       is_paid ? 1 : 0, parseInt(registration_fee)||0, external_link||'', map_embed||'']
    );
    res.status(201).json({ message: 'Event created!', event_id: r.insertId });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const [r] = await db.query('SELECT * FROM events WHERE event_id=?', [req.params.id]);
    if (!r.length) return res.status(404).json({ message: 'Event not found.' });
    res.json(r[0]);
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// PUT /api/events/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { title, description, category, status, date, venue, city, capacity, image_url,
          tags, skills_required, is_paid, registration_fee, external_link, map_embed } = req.body;
  try {
    await db.query(
      'UPDATE events SET title=?,description=?,category=?,status=?,date=?,venue=?,city=?,capacity=?,image_url=?,tags=?,skills_required=?,is_paid=?,registration_fee=?,external_link=?,map_embed=? WHERE event_id=?',
      [title, description||'', category, status, date||null, venue||'', city,
       capacity||100, image_url||'', tags||'', skills_required||'',
       is_paid ? 1 : 0, parseInt(registration_fee)||0, external_link||'', map_embed||'',
       req.params.id]
    );
    res.json({ message: 'Event updated!' });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

// DELETE /api/events/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE event_id=?', [req.params.id]);
    res.json({ message: 'Event deleted.' });
  } catch(e) { res.status(500).json({ message: 'Server error.' }); }
});

module.exports = router;
