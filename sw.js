// CACHE stämplas av scripts/build.mjs med en hash av innehållet. Filen ändras då
// vid varje ny version, vilket är det som får webbläsaren att installera om den.
const CACHE = 'gymnasiekollen-e1d8405125';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NAT_TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sidan: nätet först, så att uppdateringar syns direkt. Är nätet dåligt (som på en
// välbesökt mässa) visas den sparade versionen efter några sekunder.
async function sidan(request) {
  const cache = await caches.open(CACHE);
  const hamtning = fetch(request).then((svar) => {
    if (svar.ok) cache.put('./index.html', svar.clone());
    return svar;
  });
  const sparad = await cache.match('./index.html');
  if (!sparad) return hamtning;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(sparad), NAT_TIMEOUT_MS));
  return Promise.race([hamtning.catch(() => sparad), timeout]);
}

// Ikoner, manifest och typsnitt ändras sällan: det sparade först.
async function tillgang(request) {
  const cache = await caches.open(CACHE);
  const sparad = await cache.match(request);
  if (sparad) return sparad;
  const svar = await fetch(request);
  if (svar.ok) cache.put(request, svar.clone());
  return svar;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(sidan(e.request));
    return;
  }
  const url = new URL(e.request.url);
  if (url.origin === location.origin || FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(tillgang(e.request));
  }
});
