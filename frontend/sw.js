// EventSphere Service Worker v2 — PWA with full offline support
const CACHE = 'eventsphere-v2';
const SHELL = [
  '/', '/index.html', '/events.html', '/dashboard.html',
  '/login.html', '/signup.html', '/about.html', '/contact.html',
  '/event-details.html', '/register.html', '/success.html',
  '/admin.html', '/profile.html', '/certificate.html', '/chatbot.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-only for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ message: 'You are offline. Please check your connection.' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html').then(r => r || new Response(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline — EventSphere</title></head>
        <body style="font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FFF8EE;">
          <div style="text-align:center;padding:40px;">
            <div style="font-size:64px;margin-bottom:16px;">📡</div>
            <h1 style="color:#F5A623;font-size:24px;margin-bottom:8px;">You're Offline</h1>
            <p style="color:#555;margin-bottom:24px;">Please check your internet connection.</p>
            <button onclick="location.reload()" style="background:#F5A623;color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🔄 Try Again</button>
          </div>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )));
    })
  );
});
