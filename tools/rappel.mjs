/* ============================================================
   Rappel quotidien : envoie une notification à chaque joueur
   abonné. Exécuté une fois par jour par GitHub Actions.
   Deux secrets sont attendus dans le dépôt :
     VAPID_PRIVATE     clé privée des notifications
     SUPABASE_SERVICE  clé service_role du projet Supabase
   ============================================================ */
import webpush from 'web-push';

const SB_URL  = 'https://nrhkijgxbxslczutjrev.supabase.co';
const VAPID_PUBLIC = 'BHYwEnUhflzAepSJoP1h4cu1DBTgrea1WG-_qPSDNTvHBMvPmCSRwLr8MXlPD63n7cFPfD4foZNEcMpT8npplfQ';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const SERVICE = process.env.SUPABASE_SERVICE;

if(!VAPID_PRIVATE || !SERVICE){
  console.error('Secrets manquants : VAPID_PRIVATE et SUPABASE_SERVICE.');
  process.exit(1);
}
webpush.setVapidDetails('mailto:contact@trading.app', VAPID_PUBLIC, VAPID_PRIVATE);

const entetes = {apikey:SERVICE, Authorization:'Bearer '+SERVICE, 'Content-Type':'application/json'};

const MESSAGES = [
  {titre:'Un cycle t’attend', texte:'Trois minutes suffisent. Où est le creux cette fois ?'},
  {titre:'Ton portefeuille dort', texte:'Un cycle par jour, c’est comme ça qu’on se calibre.'},
  {titre:'Nouveau marché à lire', texte:'Crypto, indice ou grande entreprise : à toi de voir.'},
  {titre:'On reprend ?', texte:'Reconnaître la zone, dézoomer, fractionner. Un cycle.'}
];

const abos = await (await fetch(SB_URL+'/rest/v1/cyc_push?select=*', {headers:entetes})).json();
if(!Array.isArray(abos)){ console.error('Lecture impossible :', abos); process.exit(1); }
console.log(abos.length + ' abonné(s)');

const m = MESSAGES[new Date().getDate() % MESSAGES.length];
let ok=0, morts=[];
for(const a of abos){
  try{
    await webpush.sendNotification(
      {endpoint:a.endpoint, keys:{p256dh:a.p256dh, auth:a.auth}},
      JSON.stringify(m));
    ok++;
  }catch(e){
    console.log('échec', a.pseudo||a.id, e.statusCode||e.message);
    if(e.statusCode===404 || e.statusCode===410) morts.push(a.endpoint);
  }
}
// on nettoie les abonnements que le navigateur a révoqués
for(const e of morts){
  await fetch(SB_URL+'/rest/v1/cyc_push?endpoint=eq.'+encodeURIComponent(e),
    {method:'DELETE', headers:entetes});
}
console.log(`${ok} envoyé(s), ${morts.length} abonnement(s) périmé(s) supprimé(s)`);
