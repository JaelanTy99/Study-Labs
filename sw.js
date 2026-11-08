// Study Lab offline support. Once the app has been opened, a copy of it is
// kept on the device so it starts instantly and works without a connection.
// Each launch shows the saved copy and quietly fetches the latest one, so a
// new version pushed to GitHub shows up the next time the app is opened.
const CACHE = 'study-lab-app';
const FONTS = 'study-lab-fonts';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
const ROOT = new URL('./', self.location).pathname;            // e.g. /Study-Labs/
const APP = new Set(SHELL.map(p => new URL(p, self.location).pathname).concat(ROOT + 'index.html'));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The app itself: saved copy first, refreshed in the background.
  if (url.origin === self.location.origin && APP.has(url.pathname)) {
    const key = url.pathname === ROOT + 'index.html' ? ROOT : url.pathname;
    const open = caches.open(CACHE);
    const fresh = open.then(cache => fetch(req, { cache: 'no-cache' })
      .then(res => { if (res.ok) cache.put(key, res.clone()); return res; }));
    e.waitUntil(fresh.catch(() => {}));
    e.respondWith(open.then(cache => cache.match(key))
      .then(saved => saved || fresh)
      .catch(() => Response.error()));
    return;
  }

  // Google Fonts: keep a copy so the looks keep their typefaces offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async cache => {
      const saved = await cache.match(req);
      if (saved) return saved;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => Response.error()));
  }
  // Anything else (for example the book PDF links) goes to the network as normal.
});
