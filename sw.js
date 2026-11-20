// Service worker : l'application fonctionne hors connexion.
// - fichiers de l'app et bibliothèques : servis depuis le cache, mis à jour en arrière-plan
// - tuiles de carte OpenStreetMap : mises en cache au fil de l'eau (limite 3000)
// - API Adresse / OSRM : toujours en direct (l'app a un repli hors ligne)
const VERSION = 'v1.1.0';
const APP = 'app-' + VERSION;
const TILES = 'tiles-v1';
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
];
const LOCAL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/util.js', 'js/ref.js', 'js/metrics.js', 'js/route.js', 'js/pdf.js', 'js/ui.js', 'js/io.js', 'js/demo.js',
  'js/views/accueil.js', 'js/views/tournee.js', 'js/views/clients.js', 'js/views/fiche.js', 'js/views/clientForm.js',
  'js/views/stats.js', 'js/views/plus.js', 'js/icons.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    await c.addAll(LOCAL);
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  if (keys.length > 3000) for (const k of keys.slice(0, keys.length - 3000)) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); if (Math.random() < 0.02) trimTiles(); } return r; }
      catch (err) { return new Response('', { status: 504 }); }
    })());
    return;
  }
  if (url.hostname === 'api-adresse.data.gouv.fr' || url.hostname === 'router.project-osrm.org') return;
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    // Cache d'abord, rafraîchissement en arrière-plan
    e.respondWith((async () => {
      const c = await caches.open(APP);
      const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const r = await net;
      if (r) return r;
      if (req.mode === 'navigate') return (await c.match('index.html')) || new Response('Hors connexion', { status: 503 });
      return new Response('', { status: 504 });
    })());
  }
});
