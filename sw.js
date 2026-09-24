/* ============================================================
   SERVICE WORKER : l'app reste jouable hors connexion une fois
   installée sur l'écran d'accueil. Les fichiers de code passent par
   le réseau d'abord : une correction publiée arrive sans rien toucher.
   Incrémente CACHE seulement pour vider les vieux fichiers.
   ============================================================ */
const CACHE = 'trading-v16';
const SHELL = [
  './','index.html','login.html','signup.html','app.html','profil.html','roulette.html',
  'blackjack.html','poker.html','salon.html','defi.html',
  'manifest.webmanifest',
  'assets/css/style.css','assets/css/salon.css',
  'assets/js/core.js','assets/js/audio.js','assets/js/score.js','assets/data/catalogue.js',
  'assets/js/cloud.js','assets/js/chart.js','assets/js/game.js','assets/js/ui.js',
  'assets/js/app.js','assets/js/home.js','assets/js/auth.js','assets/js/profil.js',
  'assets/js/notif.js','assets/js/regles.js','assets/js/roue.js','assets/js/roulette.js',
  'assets/js/blackjack.js','assets/js/poker.js',
  'assets/js/temps-reel.js','assets/js/salon.js','assets/js/salon-jeux.js',
  'assets/js/salon-ui.js','assets/js/defi.js',
  'assets/sounds/swipe.mp3','assets/sounds/coin.mp3','assets/sounds/zoom.mp3',
  'assets/sounds/whoosh.mp3','assets/sounds/win.mp3','assets/sounds/fail.mp3',
  'assets/sounds/levelup.mp3','assets/sounds/sell.mp3','assets/sounds/click.mp3',
  'assets/icons/icon-180.png?v=2','assets/icons/icon-192.png?v=2','assets/icons/icon-512.png?v=2',
  'assets/icons/favicon.png?v=2','assets/icons/logo.png',
  'assets/icons/icon-512-maskable.png?v=2'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

/* Pages, scripts, styles et données : le réseau d'abord, pour que chaque
   correction arrive tout de suite ; le cache prend le relais hors connexion.
   Sons et icônes ne changent pas : le cache d'abord, c'est plus rapide. */
const statique = u => /\.(mp3|png|jpg|webp|ico)$/.test(u.pathname);
function mettreEnCache(req, res){
  if(res && res.ok && req.method==='GET'){
    const copie = res.clone();
    caches.open(CACHE).then(c=>c.put(req, copie)).catch(()=>{});
  }
  return res;
}
self.addEventListener('fetch', e=>{
  const req = e.request, u = new URL(req.url);
  // les appels Supabase ne sont jamais mis en cache
  if(u.origin !== location.origin || req.method !== 'GET') return;
  if(statique(u)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res=>mettreEnCache(req,res))));
    return;
  }
  e.respondWith(
    fetch(req).then(res=>mettreEnCache(req,res)).catch(()=>
      caches.match(req, {ignoreSearch: req.mode==='navigate'}).then(r=>{
        if(r) return r;
        // une page inconnue hors connexion : on montre l'accueil, jamais pour un script
        if(req.mode==='navigate') return caches.match('index.html');
        return new Response('', {status:504, statusText:'Hors connexion'});
      }))
  );
});

/* ---------- rappel quotidien ---------- */
self.addEventListener('push', e=>{
  let d = {titre:'Trading', texte:'Un cycle t’attend.'};
  try{ if(e.data) d = Object.assign(d, e.data.json()); }catch(err){}
  e.waitUntil(self.registration.showNotification(d.titre, {
    body: d.texte,
    icon: 'assets/icons/icon-192.png?v=2',
    badge: 'assets/icons/icon-192.png?v=2',
    tag: 'rappel-quotidien',
    data: {url:'index.html'}
  }));
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'index.html';
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
    for(const c of list){ if('focus' in c) return c.focus().then(()=>c.navigate ? c.navigate(url) : null)
      .catch(()=>clients.openWindow(url)); }
    return clients.openWindow(url);
  }));
});
