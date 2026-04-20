/* EventSphere Chatbot v2 — Smart local engine, no API key needed */
(function () {
  'use strict';

  const BURL =
    localStorage.getItem('backendURL') ||
    (window.location.port === '5000' || window.location.port === '3000'
      ? ''
      : 'http://localhost:5000');

  /* ── Styles ────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #es-chat-btn {
      position:fixed; bottom:28px; right:28px; z-index:9999;
      width:56px; height:56px; border-radius:50%;
      background:linear-gradient(135deg,#F5A623,#E09400);
      border:none; cursor:pointer; font-size:24px;
      box-shadow:0 4px 20px rgba(245,166,35,.45);
      display:flex; align-items:center; justify-content:center;
      transition:transform .2s,box-shadow .2s;
    }
    #es-chat-btn:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(245,166,35,.55);}
    #es-chat-panel {
      position:fixed; bottom:96px; right:28px; z-index:9999;
      width:320px; height:460px; background:#fff; border-radius:18px;
      box-shadow:0 8px 40px rgba(0,0,0,.18);
      display:none; flex-direction:column; overflow:hidden;
      font-family:'Plus Jakarta Sans',sans-serif;
      border:1px solid rgba(0,0,0,.08);
      animation:esChatIn .25s cubic-bezier(.34,1.2,.64,1);
    }
    @keyframes esChatIn{from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
    #es-chat-panel.open{display:flex;}
    [data-theme="dark"] #es-chat-panel{background:#1C1C1C;border-color:#2e2e2e;}
    .es-chat-head{background:linear-gradient(135deg,#F5A623,#E09400);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;}
    .es-chat-head-left{display:flex;align-items:center;gap:10px;}
    .es-chat-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:18px;}
    .es-chat-title{font-size:15px;font-weight:700;color:#fff;}
    .es-chat-status{font-size:11px;color:rgba(255,255,255,.85);}
    .es-chat-close{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.85);font-size:20px;line-height:1;padding:2px 6px;border-radius:6px;transition:background .15s;}
    .es-chat-close:hover{background:rgba(255,255,255,.2);}
    .es-chat-body{flex:1;overflow-y:auto;padding:14px 14px 4px;display:flex;flex-direction:column;gap:10px;}
    .es-chat-body::-webkit-scrollbar{width:4px;}
    .es-chat-body::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}
    .es-msg{max-width:88%;font-size:13.5px;line-height:1.55;}
    .es-msg.bot{align-self:flex-start;}
    .es-msg.user{align-self:flex-end;}
    .es-bubble{padding:9px 13px;border-radius:14px;display:inline-block;word-break:break-word;}
    .es-msg.bot .es-bubble{background:#F3F4F6;color:#1A1A2E;border-bottom-left-radius:4px;}
    [data-theme="dark"] .es-msg.bot .es-bubble{background:#2a2a2a;color:#eee;}
    .es-msg.user .es-bubble{background:linear-gradient(135deg,#F5A623,#E09400);color:#fff;border-bottom-right-radius:4px;}
    .es-typing{display:flex;gap:5px;padding:10px 13px;}
    .es-dot{width:7px;height:7px;border-radius:50%;background:#bbb;animation:esBounce 1.2s infinite;}
    .es-dot:nth-child(2){animation-delay:.2s;}
    .es-dot:nth-child(3){animation-delay:.4s;}
    @keyframes esBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}
    .es-chat-footer{padding:10px 12px;border-top:1px solid #eee;display:flex;gap:8px;align-items:center;}
    [data-theme="dark"] .es-chat-footer{border-color:#2e2e2e;}
    #es-chat-input{flex:1;border:1.5px solid #e2e6ea;border-radius:10px;padding:8px 12px;font-size:13.5px;outline:none;font-family:inherit;background:#fff;color:#1A1A2E;transition:border-color .2s;}
    [data-theme="dark"] #es-chat-input{background:#2a2a2a;color:#eee;border-color:#3a3a3a;}
    #es-chat-input:focus{border-color:#F5A623;}
    #es-chat-send{background:#F5A623;border:none;border-radius:10px;width:36px;height:36px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background .2s,transform .15s;flex-shrink:0;}
    #es-chat-send:hover{background:#E09400;transform:scale(1.05);}
    .es-chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}
    .es-chip{padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:#FDE8CC;color:#92400E;cursor:pointer;border:none;font-family:inherit;transition:background .15s;}
    .es-chip:hover{background:#F5A623;color:#fff;}
  `;
  document.head.appendChild(style);

  /* ── DOM ──────────────────────────────────────────── */
  const btn = document.createElement('button');
  btn.id = 'es-chat-btn';
  btn.title = 'Chat with EventSphere';
  btn.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.id = 'es-chat-panel';
  panel.innerHTML = `
    <div class="es-chat-head">
      <div class="es-chat-head-left">
        <div class="es-chat-avatar">🤖</div>
        <div>
          <div class="es-chat-title">EventSphere Bot</div>
          <div class="es-chat-status">● Online</div>
        </div>
      </div>
      <button class="es-chat-close" id="es-chat-close">✕</button>
    </div>
    <div class="es-chat-body" id="es-chat-body"></div>
    <div class="es-chat-footer">
      <input id="es-chat-input" type="text" placeholder="Ask me anything..." maxlength="200"/>
      <button id="es-chat-send">➤</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  /* ── State ────────────────────────────────────────── */
  let isOpen = false;
  let EVENTS = [];
  let greeted = false;

  /* ── Fetch events from backend ───────────────────── */
  async function fetchEvents() {
    try {
      const r = await fetch(BURL + '/api/events?limit=50');
      if (!r.ok) throw new Error('Bad response');
      const d = await r.json();
      EVENTS = d.events || [];
    } catch (e) {
      EVENTS = [];
      console.warn('[Chatbot] Could not fetch events from backend:', e.message);
    }
  }

  /* ── Toggle panel ─────────────────────────────────── */
  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? '✕' : '💬';
    if (isOpen) {
      // Always re-fetch events on open so data is fresh after login/registration
      fetchEvents().then(() => {
        if (!greeted) {
          greeted = true;
          showGreeting();
        }
      });
      setTimeout(() => document.getElementById('es-chat-input').focus(), 120);
    }
  }

  btn.addEventListener('click', togglePanel);
  document.getElementById('es-chat-close').addEventListener('click', togglePanel);
  document.getElementById('es-chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
  document.getElementById('es-chat-send').addEventListener('click', sendMsg);

  /* ── Message helpers ──────────────────────────────── */
  function addMsg(html, who) {
    const body = document.getElementById('es-chat-body');
    const div = document.createElement('div');
    div.className = `es-msg ${who}`;
    div.innerHTML = `<div class="es-bubble">${html}</div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function addChips(chips) {
    const body = document.getElementById('es-chat-body');
    const row = document.createElement('div');
    row.className = 'es-chip-row es-msg bot';
    row.innerHTML = chips.map(c =>
      `<button class="es-chip" onclick="document.getElementById('es-chat-input').value='${c}';document.getElementById('es-chat-send').click()">${c}</button>`
    ).join('');
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const body = document.getElementById('es-chat-body');
    const div = document.createElement('div');
    div.className = 'es-msg bot'; div.id = 'es-typing';
    div.innerHTML = `<div class="es-bubble es-typing"><div class="es-dot"></div><div class="es-dot"></div><div class="es-dot"></div></div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('es-typing');
    if (t) t.remove();
  }

  /* ── Greeting ─────────────────────────────────────── */
  function showGreeting() {
    const userStr = localStorage.getItem('user');
    let name = '';
    try { name = JSON.parse(userStr).name.split(' ')[0]; } catch(e) {}
    const greet = name ? `Hey ${name}! 👋` : 'Hey there! 👋';
    addMsg(`${greet} I'm the EventSphere assistant. I can help you find events, check details, or answer questions. What's on your mind?`, 'bot');
    addChips(['Upcoming events', 'Free events', 'Events in Pune', 'Hackathons', 'How to register']);
  }

  /* ── Smart reply engine ───────────────────────────── */
  function smartReply(rawText) {
    const q = rawText.toLowerCase().trim();
    const evs = EVENTS;

    // ── Greetings & small talk
    if (/^(hi|hello|hey|namaste|hlo|hii|sup|yo|howdy)\b/.test(q))
      return { text: "Hey! 👋 How can I help you today? You can ask about events, cities, categories, registration and more!" };

    if (/how are you|how r u|wassup|what's up/.test(q))
      return { text: "I'm doing great, thanks for asking! 😊 Ready to help you find the perfect event. What are you looking for?" };

    if (/(thank|thanks|thx|ty\b|thank you)/.test(q))
      return { text: "You're welcome! 😊 Is there anything else I can help you with?" };

    if (/bye|goodbye|see you|cya/.test(q))
      return { text: "Goodbye! 👋 Hope to see you at an event soon!" };

    if (/help|what can you do|what do you|commands/.test(q))
      return { text: "I can help you with:<br>🔍 Find events by city or category<br>📅 See upcoming events<br>🆓 Free events list<br>💰 Paid events<br>🎯 Hackathons, workshops, seminars<br>📝 Registration help<br>📊 Event counts & stats<br><br>Just ask in plain English!", chips: ['Upcoming events', 'Free events', 'Hackathons in Pune'] };

    // ── Free events (also matches typos like 'free evnts', 'freee', 'free event')
    if (/free/.test(q)) {
      const free = evs.filter(e => !e.is_paid && !(e.registration_fee > 0));
      if (!free.length && !evs.length) return { text: "I couldn't load event data right now. Please check the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a> for free events! 🆓" };
      if (!free.length) return { text: "All listed events are paid. Check the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a> for updates! 🆓" };
      const list = free.slice(0, 5).map(e => `• <b>${e.title}</b> — ${e.city}`).join('<br>');
      return { text: `🆓 <b>Free Events (${free.length} total):</b><br>${list}${free.length > 5 ? `<br>…and ${free.length - 5} more on the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a>` : ''}` };
    }

    // ── Paid events
    if (/paid|fee|cost|price|money|rupee|₹/.test(q)) {
      const paid = evs.filter(e => e.is_paid == 1 || e.registration_fee > 0);
      if (!paid.length) return { text: "All listed events are free to register! 🎉" };
      const list = paid.slice(0, 4).map(e => `• <b>${e.title}</b> — ₹${e.registration_fee || 0}`).join('<br>');
      return { text: `💰 <b>Paid Events (${paid.length} total):</b><br>${list}` };
    }

    // ── City + status combo (e.g. "completed events in pune")
    const cities = { pune: 'Pune', mumbai: 'Mumbai', nagpur: 'Nagpur', bangalore: 'Bangalore', delhi: 'Delhi' };
    const statuses = { complet: 'Completed', past: 'Completed', done: 'Completed', finish: 'Completed', over: 'Completed', upcoming: 'Upcoming', next: 'Upcoming', soon: 'Upcoming', ongoing: 'Ongoing' };

    const cityKey = Object.keys(cities).find(c => q.includes(c));
    const statKey = Object.keys(statuses).find(s => q.includes(s));

    if (cityKey && statKey) {
      const filtered = evs.filter(e =>
        (e.city || '').toLowerCase().includes(cityKey) &&
        (e.status || '').toLowerCase() === statuses[statKey].toLowerCase()
      );
      const cityName = cities[cityKey];
      const statName = statuses[statKey];
      if (!filtered.length) return { text: `No ${statName} events found in ${cityName} right now. Check the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a> for updates! 🏙️` };
      const list = filtered.slice(0, 5).map(e => `• <b>${e.title}</b> (${e.category})`).join('<br>');
      return { text: `📍 <b>${statName} Events in ${cityName}:</b><br>${list}${filtered.length > 5 ? `<br>…and ${filtered.length - 5} more` : ''}` };
    }

    // ── City only
    if (cityKey) {
      const cityName = cities[cityKey];
      if (!evs.length) {
        return { text: `📍 Searching for events in <b>${cityName}</b>... The events list is still loading. Please visit the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a> and filter by city! 🏙️` };
      }
      const cityEvs = evs.filter(e => (e.city || '').toLowerCase().includes(cityKey));
      if (!cityEvs.length) return { text: `No events found in ${cityName} right now. Check back soon! 🏙️` };
      const upcoming = cityEvs.filter(e => e.status === 'Upcoming');
      const list = (upcoming.length ? upcoming : cityEvs).slice(0, 5).map(e => `• <b>${e.title}</b> — ${e.category} (${e.status})`).join('<br>');
      return { text: `📍 <b>Events in ${cityName} (${cityEvs.length} total):</b><br>${list}${cityEvs.length > 5 ? `<br>…and ${cityEvs.length - 5} more` : ''}`, chips: [`Hackathons in ${cityName}`, `Free events in ${cityName}`] };
    }

    // ── Category
    const catMap = { hackathon: 'Hackathon', workshop: 'Workshop', seminar: 'Seminar', technical: 'Technical', cultural: 'Cultural', sports: 'Sports' };
    const catKey = Object.keys(catMap).find(k => q.includes(k));
    if (catKey) {
      const catEvs = evs.filter(e => (e.category || '').toLowerCase() === catKey);
      if (!catEvs.length) return { text: `No ${catMap[catKey]} events found right now. New events are added regularly! Check the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a>.` };
      const list = catEvs.slice(0, 5).map(e => `• <b>${e.title}</b> — ${e.city} (${e.status})`).join('<br>');
      return { text: `🗂️ <b>${catMap[catKey]} Events (${catEvs.length}):</b><br>${list}${catEvs.length > 5 ? `<br>…and ${catEvs.length - 5} more` : ''}` };
    }

    // ── Status only
    if (statKey) {
      const statName = statuses[statKey];
      const statEvs = evs.filter(e => (e.status || '').toLowerCase() === statName.toLowerCase());
      if (!statEvs.length) return { text: `No ${statName} events right now. Check the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a>! 📅` };
      const list = statEvs.slice(0, 5).map(e => `• <b>${e.title}</b> — ${e.city} (${e.category})`).join('<br>');
      return { text: `📅 <b>${statName} Events (${statEvs.length} total):</b><br>${list}${statEvs.length > 5 ? `<br>…and ${statEvs.length - 5} more on the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a>` : ''}` };
    }

    // ── Count / stats
    if (/how many|count|total|number of|stats/.test(q)) {
      if (!evs.length) return { text: "I'm loading event data. Please try again in a moment! 🔄" };
      const byCity = {};
      const byCat = {};
      evs.forEach(e => {
        byCity[e.city] = (byCity[e.city] || 0) + 1;
        byCat[e.category] = (byCat[e.category] || 0) + 1;
      });
      const upcoming = evs.filter(e => e.status === 'Upcoming').length;
      const completed = evs.filter(e => e.status === 'Completed').length;
      const cityStr = Object.entries(byCity).map(([k, v]) => `${k}: ${v}`).join(' • ');
      return { text: `📊 <b>EventSphere Stats:</b><br>Total events: <b>${evs.length}</b><br>Upcoming: ${upcoming} | Completed: ${completed}<br><br>By city: ${cityStr}` };
    }

    // ── Registration help
    if (/register|sign up|signup|book|enroll|how to/.test(q)) {
      const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } })();
      if (!user) return { text: "To register for an event:<br>1️⃣ <a href='signup.html' style='color:#F5A623;font-weight:700'>Create an account</a> or <a href='login.html' style='color:#F5A623;font-weight:700'>Login</a><br>2️⃣ Browse the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a><br>3️⃣ Click on any event → hit <b>Register Now</b><br>4️⃣ You'll get a QR code ticket! 🎫" };
      return { text: "You're already logged in! 🎉<br>Just go to the <a href='events.html' style='color:#F5A623;font-weight:700'>Events page</a>, click any event, and hit <b>Register Now</b>. You'll get a QR ticket on success! 🎫" };
    }

    // ── Dashboard / my tickets
    if (/my event|dashboard|my ticket|my registr|my booking/.test(q))
      return { text: "You can see all your registered events and QR tickets in your <a href='dashboard.html' style='color:#F5A623;font-weight:700'>Dashboard</a> 📊" };

    // ── Contact
    if (/contact|email|support|reach|help desk/.test(q))
      return { text: "You can reach the EventSphere team via the <a href='contact.html' style='color:#F5A623;font-weight:700'>Contact page</a> 📬" };

    // ── About
    if (/about|what is eventsphere|who built|who made/.test(q))
      return { text: "EventSphere is a full-stack event management platform for college events across Pune, Mumbai, Nagpur, Bangalore, and Delhi! 🎯<br>Built with Node.js, Express, MySQL, HTML/CSS/JS." };

    // ── Specific event name search
    const nameMatch = evs.find(e => e.title && q.includes((e.title || '').toLowerCase().slice(0, 6)));
    if (nameMatch)
      return { text: `📌 <b>${nameMatch.title}</b><br>📍 ${nameMatch.venue || ''}, ${nameMatch.city}<br>📂 ${nameMatch.category} • ${nameMatch.status}<br>👥 ${nameMatch.registered_count || 0}/${nameMatch.capacity || 100} seats filled<br><a href='event-details.html?id=${nameMatch.event_id}' style='color:#F5A623;font-weight:700'>View Event →</a>` };

    // ── Default helpful fallback
    const sample = evs.slice(0, 3).map(e => `• ${e.title} — ${e.city}`).join('<br>');
    return {
      text: `I can help you find events! 🤖 Try asking:<br>• "upcoming events in Pune"<br>• "free events"<br>• "hackathons"<br>• "completed events in Mumbai"<br>• "how many events are there"${sample ? '<br><br>Some events right now:<br>' + sample : ''}`,
      chips: ['Upcoming events', 'Free events', 'Hackathons', 'Events in Mumbai'],
      isDefault: true
    };
  }

  /* ── Send message ─────────────────────────────────── */
  const conversationHistory = [];

  async function sendMsg() {
    const input = document.getElementById('es-chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    // Remove old chips
    document.querySelectorAll('.es-chip-row').forEach(r => r.remove());

    addMsg(text, 'user');
    conversationHistory.push({ role: 'user', content: text });
    showTyping();

    // Try smart local reply first for quick responses
    const localResult = smartReply(text);
    const isGenericFallback = localResult.isDefault === true;

    if (!isGenericFallback) {
      await new Promise(r => setTimeout(r, 300));
      removeTyping();
      addMsg(localResult.text, 'bot');
      conversationHistory.push({ role: 'assistant', content: localResult.text });
      if (localResult.chips && localResult.chips.length) addChips(localResult.chips);
      return;
    }

    // Fall back to AI — strictly DB-only, no hallucination allowed
    try {
      // Build full event list from actual DB data
      const evSummary = EVENTS.length > 0
        ? EVENTS.map(e =>
            `ID:${e.event_id} | ${e.title} | City:${e.city} | Category:${e.category} | Status:${e.status} | Fee:${e.is_paid ? '₹'+(e.registration_fee||0) : 'Free'} | Seats:${e.registered_count||0}/${e.capacity||100}`
          ).join('\n')
        : 'No events available in the database.';

      const response = await fetch(BURL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are EventSphere Bot, a helpful assistant for a college events platform in India.
STRICT RULES:
1. ONLY answer using the event data provided below. Do NOT invent, guess, or generate any event details.
2. If the answer is not in the data below, say: "I don't have that information. Please check the Events page."
3. Keep responses under 3 sentences. Use emojis sparingly.
4. Never mention Anthropic, Claude, or AI.

CURRENT DATABASE EVENTS:
${evSummary}`,
          messages: conversationHistory.slice(-6)
        })
      });

      removeTyping();

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      const aiText = (data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text.trim()
        : null;

      if (aiText) {
        addMsg(aiText.replace(/\n/g, '<br>'), 'bot');
        conversationHistory.push({ role: 'assistant', content: aiText });
      } else {
        addMsg(localResult.text, 'bot');
        conversationHistory.push({ role: 'assistant', content: localResult.text });
        if (localResult.chips && localResult.chips.length) addChips(localResult.chips);
      }
    } catch (err) {
      removeTyping();
      // Backend not available — show helpful local fallback
      addMsg(localResult.text, 'bot');
      conversationHistory.push({ role: 'assistant', content: localResult.text });
      if (localResult.chips && localResult.chips.length) addChips(localResult.chips);
    }
  }
})();
