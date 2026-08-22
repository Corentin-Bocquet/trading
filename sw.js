/* ============================================================
   SERVICE WORKER : l'app reste jouable hors connexion une fois
   installée sur l'écran d'accueil. Incrémente CACHE à chaque
   modification de fichier pour forcer la mise à jour.
   ============================================================ */
const CACHE = 'trading-v6';
const SHELL = [
  'index.html','login.html','signup.html','app.html','profil.html',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/core.js','assets/js/audio.js','assets/js/score.js','assets/data/catalogue.js',
  'assets/js/cloud.js','assets/js/chart.js','assets/js/game.js','assets/js/ui.js',
  'assets/js/app.js','assets/js/home.js','assets/js/auth.js','assets/js/profil.js',
  'assets/js/notif.js',
  'assets/sounds/swipe.mp3','assets/sounds/coin.mp3','assets/sounds/zoom.mp3',
  'assets/sounds/whoosh.mp3','assets/sounds/win.mp3','assets/sounds/fail.mp3',
  'assets/sounds/levelup.mp3','assets/sounds/sell.mp3','assets/sounds/click.mp3',
  'assets/icons/icon-180.png','assets/icons/icon-192.png','assets/icons/icon-512.png',
  'assets/icons/favicon.png','assets/icons/logo.png',
  'assets/icons/icon-512-maskable.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const u = new URL(e.request.url);
  // les appels Supabase ne sont jamais mis en cache
  if(u.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=>caches.match('index.html')))
  );
});

/* ---------- rappel quotidien ---------- */
self.addEventListener('push', e=>{
  let d = {titre:'Trading', texte:'Un cycle t’attend.'};
  try{ if(e.data) d = Object.assign(d, e.data.json()); }catch(err){}
  e.waitUntil(self.registration.showNotification(d.titre, {
    body: d.texte,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    tag: 'rappel-quotidien',
    data: {url:'app.html'}
  }));
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'index.html';
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
    for(const c of list){ if('focus' in c) return c.navigate(url).then(()=>c.focus()); }
    return clients.openWindow(url);
  }));
});
