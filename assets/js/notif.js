/* ============================================================
   RAPPEL QUOTIDIEN
   L'abonnement est enregistré côté serveur ; une tâche planifiée
   envoie la notification une fois par jour.
   Sur iPhone, il faut d'abord installer l'app sur l'écran d'accueil :
   Safari seul n'autorise pas les notifications.
   ============================================================ */
const VAPID_PUBLIC = 'BHYwEnUhflzAepSJoP1h4cu1DBTgrea1WG-_qPSDNTvHBMvPmCSRwLr8MXlPD63n7cFPfD4foZNEcMpT8npplfQ';

const Notif = (() => {
  const dispo = () => 'serviceWorker' in navigator && 'PushManager' in window
                   && 'Notification' in window && location.protocol==='https:';

  // iOS n'expose les notifications que dans l'app installée
  const installee = () => window.matchMedia('(display-mode: standalone)').matches
                       || window.navigator.standalone === true;

  function b64ToU8(base64){
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const s = (base64 + pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(s); const out = new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
    return out;
  }

  async function etat(){
    if(!dispo()) return 'indisponible';
    try{
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? 'actif' : 'inactif';
    }catch(e){ return 'indisponible'; }
  }

  async function activer(){
    if(!dispo()) throw new Error(
      'Les rappels ont besoin de l’app en ligne (https). Ouvre-la depuis son adresse web.');
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if(iOS && !installee()) throw new Error(
      'Sur iPhone : ajoute d’abord l’app à ton écran d’accueil (Partager → Sur l’écran d’accueil), puis reviens ici.');
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') throw new Error('Tu as refusé les notifications dans le navigateur.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({
      userVisibleOnly:true, applicationServerKey:b64ToU8(VAPID_PUBLIC)});
    const j = sub.toJSON();
    await Cloud.savePush({endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth});
    return true;
  }

  async function desactiver(){
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){ await Cloud.removePush(sub.endpoint); await sub.unsubscribe(); }
    return true;
  }

  return {dispo, installee, etat, activer, desactiver};
})();
