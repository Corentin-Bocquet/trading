/* ============================================================
   SALONS EN LIGNE
   Un canal « hall » où tout le monde se signale, et un canal par
   table. Le joueur dont l'identifiant est le plus petit tient la
   table : c'est lui qui tire les cartes et les numéros, applique
   les actions reçues et rediffuse l'état complet. Tout le monde
   calcule le même hôte, donc la table survit à son départ.
   ============================================================ */
const S = {
  moi:{id:'', pseudo:'', avatar:null},
  code:null, jeu:null,
  hall:null, canal:null,
  joueurs:[], hote:null,
  etat:null,                      // état de jeu diffusé par l'hôte
  cles:null,                      // paire RSA pour les cartes privées
  maMain:null, maChiffree:null,   // mes cartes privées, déchiffrées
  clairHote:{},                   // ce que l'hôte seul connaît
  horsTable:0                     // ce qui reste hors de la table de poker
};

const estHote = () => S.hote && S.hote === S.moi.id;
const moiDansTable = () => S.joueurs.find(j=>j.id===S.moi.id);
const codeAleatoire = () => {
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r=new Uint32Array(4);
  crypto.getRandomValues(r);
  return [...r].map(x=>a[x%a.length]).join('');
};

/* ---------- cartes privées : chacun sa paire de clés ---------- */
async function preparerCles(){
  if(S.cles) return S.cles;
  const paire = await crypto.subtle.generateKey(
    {name:'RSA-OAEP', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'},
    true, ['encrypt','decrypt']);
  const pub = await crypto.subtle.exportKey('jwk', paire.publicKey);
  S.cles = {paire, pub:{n:pub.n, e:pub.e}};
  return S.cles;
}
async function chiffrerPour(pubJwk, objet){
  const cle = await crypto.subtle.importKey('jwk',
    {kty:'RSA', n:pubJwk.n, e:pubJwk.e, alg:'RSA-OAEP-256', ext:true, key_ops:['encrypt']},
    {name:'RSA-OAEP', hash:'SHA-256'}, true, ['encrypt']);
  const octets = new TextEncoder().encode(JSON.stringify(objet));
  const chiffre = await crypto.subtle.encrypt({name:'RSA-OAEP'}, cle, octets);
  return btoa(String.fromCharCode(...new Uint8Array(chiffre)));
}
async function dechiffrer(b64){
  const brut = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
  const clair = await crypto.subtle.decrypt({name:'RSA-OAEP'}, S.cles.paire.privateKey, brut);
  return JSON.parse(new TextDecoder().decode(clair));
}

/* ---------- hall : qui est en ligne, quelles tables sont ouvertes ---------- */
function rejoindreHall(){
  S.hall = TempsReel.canal('hall', {
    cle: S.moi.id,
    meta: {id:S.moi.id, pseudo:S.moi.pseudo, avatar:S.moi.avatar, table:null, jeu:null},
    surPresence: liste => {
      const vus = new Map();
      liste.forEach(j=>{ if(j.id) vus.set(j.id, j); });   // un seul par compte
      peindreHall([...vus.values()]);
    }
  });
}
function signalerHall(){
  if(S.hall) S.hall.suivre({id:S.moi.id, pseudo:S.moi.pseudo, avatar:S.moi.avatar,
                            table:S.code, jeu:S.jeu});
}

function peindreHall(liste){
  const autres = liste.filter(j=>j.id!==S.moi.id);
  const enLigne = $('#hall-joueurs');
  if(enLigne) enLigne.innerHTML = autres.length
    ? autres.map(j=>`<div class="lbline">
        ${avatar(j.pseudo, j.avatar)}
        <div class="nm">${esc(j.pseudo)}</div>
        <div class="pt">${j.table ? (JEUX[j.jeu]||{nom:'EN TABLE'}).nom : 'DANS LE HALL'}</div>
      </div>`).join('')
    : '<p class="note">Personne d’autre en ligne pour l’instant.</p>';

  const tables = {};
  liste.forEach(j=>{ if(j.table && /^[A-Z0-9]{4}$/.test(j.table) && JEUX[j.jeu]){
    (tables[j.table] = tables[j.table] || {jeu:j.jeu, n:0}).n++; } });
  S.tablesOuvertes = tables;
  const box = $('#hall-tables');
  if(box) box.innerHTML = Object.keys(tables).length
    ? Object.entries(tables).map(([code,t])=>`
        <div class="lbline tablerow" data-code="${code}" data-jeu="${t.jeu}">
          <div class="rk">${t.n}</div>
          <div class="nm">TABLE ${code}</div>
          <div class="pt">${(JEUX[t.jeu]||{nom:'?'}).nom}</div>
        </div>`).join('')
    : '<p class="note">Aucune table ouverte. Crée la première.</p>';
  $$('#hall-tables .tablerow').forEach(r=>{
    r.onclick = ()=>{ Audio_.play('click'); rejoindreTable(r.dataset.code, r.dataset.jeu); };
  });
}

/* ---------- table ---------- */
async function rejoindreTable(code, jeu){
  await preparerCles();
  S.code = code.toUpperCase();
  // le jeu d'une table existante est celui de la table, pas celui coché dans le hall
  const connue = S.tablesOuvertes && S.tablesOuvertes[S.code];
  S.jeu = connue ? connue.jeu : jeu; S.etat = null; jeu = S.jeu;
  localStorage.setItem('cyc_table', JSON.stringify({code:S.code, jeu}));

  S.canal = TempsReel.canal('salon:'+S.code, {
    cle: S.moi.id,
    meta: {id:S.moi.id, pseudo:S.moi.pseudo, avatar:S.moi.avatar,
           caisse: caisseDe(G.prof, jeu), pub:S.cles.pub, pret:false, depuis:Date.now()},
    surPresence: liste=>{
      const vus = new Map();
      liste.forEach(j=>{ if(j.id) vus.set(j.id, j); });
      // l'hôte est le premier arrivé : un nouveau venu ne prend jamais la main
      // en pleine partie (et tout le monde fait le même tri, donc le même choix)
      S.joueurs = [...vus.values()].sort((a,b)=>((a.depuis||0)-(b.depuis||0)) || (a.id<b.id?-1:1));
      S.hote = S.joueurs.length ? S.joueurs[0].id : null;
      peindreTable();
      if(estHote()) hoteVerifie();
    },
    surMessage: (event, payload)=>{
      // l'hôte reçoit l'écho de sa propre diffusion : s'il l'appliquait, il
      // remplacerait son état par une copie et ses minuteries en cours
      // travailleraient sur un objet devenu orphelin
      if(event==='etat'){ if(estHote()) return;
                          // table créée pour un autre jeu que celui choisi : on s'aligne
                          if(payload && payload.jeu && payload.jeu!==S.jeu && JEUX[payload.jeu]){
                            S.jeu = payload.jeu; localStorage.setItem('cyc_table', JSON.stringify({code:S.code, jeu:S.jeu}));
                            signalerHall(); peindreTable(); }
                          S.etat = payload; appliquerEtat(payload); }
      else if(event==='action' && estHote()) hoteAction(payload.de, payload.action);
      else if(event==='chat') ajouterChat(payload);
    }
  });
  signalerHall();
  montrer('table');
}

function quitterTable(){
  try{ if(typeof avantQuitter==='function') avantQuitter(); }catch(e){}
  if(S.canal) S.canal.quitter();
  S.maMain=null; S.maChiffree=null; S.clairHote={};
  S.canal=null; S.code=null; S.jeu=null; S.etat=null; S.joueurs=[]; S.hote=null;
  localStorage.removeItem('cyc_table');
  signalerHall();
  montrer('hall');
}

function envoyerAction(action){
  if(!S.canal) return;
  if(estHote()) hoteAction(S.moi.id, action);      // l'hôte s'applique à lui-même
  else S.canal.envoyer('action', {de:S.moi.id, action});
}
function diffuserEtat(){
  if(!estHote() || !S.canal) return;
  S.canal.envoyer('etat', S.etat);
  appliquerEtat(S.etat);
}

function seDeclarerPret(pret){
  const m = S.canal && S.canal.meta;
  if(!m) return;
  S.canal.suivre(Object.assign({}, m, {pret, caisse:caisseDe(G.prof, S.jeu)}));
}

/* ---------- navigation entre les deux écrans ---------- */
function montrer(quoi){
  $('#vue-hall').style.display  = quoi==='hall'  ? '' : 'none';
  $('#vue-table').style.display = quoi==='table' ? '' : 'none';
  const nav = $('nav.tabbar'); if(nav) nav.style.display = quoi==='hall' ? '' : 'none';
}

function ajouterChat(p){
  const z = $('#chat'); if(!z) return;
  const d = document.createElement('div');
  d.className = 'chatline';
  d.innerHTML = `<b>${esc(p.pseudo)}</b> ${esc(String(p.texte||'').slice(0,120))}`;
  z.appendChild(d); z.scrollTop = z.scrollHeight;
  while(z.children.length>40) z.removeChild(z.firstChild);
}

/* ---------- rendu commun de la table ---------- */
function peindreTable(){
  $('#t-code').textContent = S.code || '';
  $('#t-jeu').textContent  = (JEUX[S.jeu]||{nom:''}).nom;
  $('#t-hote').textContent = S.hote
    ? ('table tenue par ' + ((S.joueurs.find(j=>j.id===S.hote)||{}).pseudo||'?')) : '';
  $('#t-joueurs').innerHTML = S.joueurs.map(j=>`
    <div class="lbline${j.id===S.moi.id?' me':''}">
      ${avatar(j.pseudo, j.avatar)}
      <div class="nm">${esc(j.pseudo)}${j.id===S.hote?' <span class="serie">HÔTE</span>':''}</div>
      <div class="pt">${sousJeu(j.caisse!=null?j.caisse:JEUX[S.jeu].depart, S.jeu)}
        ${j.pret?'<span class="pretok">PRÊT</span>':''}</div>
    </div>`).join('');
  if(typeof peindreJeu==='function') peindreJeu();
}

/* ---------- amorçage ---------- */
(async function bootSalon(){
  if(!requireAuth()) return;
  wireModeSwitch();
  try{ await Cloud.restore(); }catch(e){}
  S.moi = {id: (G.user && G.user.id) || ('local-'+Math.random().toString(36).slice(2)),
           pseudo: G.prof.pseudo, avatar: G.prof.avatar};
  await preparerCles();
  cablerJeuxOL();
  rejoindreHall();
  montrer('hall');

  TempsReel.surEtat(e=>{
    const b = $('#lien');
    if(b){ b.textContent = e==='ouvert' ? 'EN LIGNE' : e==='connexion' ? 'CONNEXION…' : 'HORS LIGNE';
           b.className = 'lien '+e; }
  });

  $$('.mgrid .mbtn[data-jeu]').forEach(b=>{
    b.onclick = ()=>{ Audio_.play('click');
      $$('.mgrid .mbtn[data-jeu]').forEach(x=>x.classList.toggle('on', x===b));
      $('#creer-jeu').value = b.dataset.jeu; };
  });
  $('#b-creer').onclick = ()=>{ Audio_.play('click');
    const jeu = $('#creer-jeu').value || 'roulette';
    rejoindreTable(codeAleatoire(), jeu); };
  $('#b-rejoindre').onclick = ()=>{ Audio_.play('click');
    const c = ($('#code-saisi').value||'').trim().toUpperCase();
    if(!/^[A-Z0-9]{4}$/.test(c)){ $('#hall-err').textContent = 'Entre le code à 4 caractères de la table.'; return; }
    $('#hall-err').textContent = '';
    const jeu = $('#creer-jeu').value || 'roulette';
    rejoindreTable(c, jeu); };
  $('#b-quitter').onclick = ()=>{ Audio_.play('click'); quitterTable(); };
  // inviter : le lien ouvre directement la bonne table chez l'ami
  $('#b-partager').onclick = async ()=>{ Audio_.play('click'); if(!S.code) return;
    const url = location.href.split('#')[0].split('?')[0]+'?table='+S.code;
    const txt = 'Rejoins ma table de '+(JEUX[S.jeu]||{nom:''}).nom.toLowerCase()+' : code '+S.code;
    try{ if(navigator.share){ await navigator.share({title:'Trading', text:txt, url}); return; } }catch(e){ return; }
    try{ await navigator.clipboard.writeText(txt+' '+url); msgTable('Lien copié, colle-le à tes amis.'); }
    catch(e){ msgTable('Code de la table : '+S.code); }
  };
  // la page revient du cache arrière (retour en arrière) : on repart proprement
  window.addEventListener('pageshow', e=>{ if(e.persisted) location.reload(); });
  $('#b-pret').onclick = ()=>{
    const m = moiDansTable();
    Audio_.play('click'); seDeclarerPret(!(m && m.pret));
  };
  const ch = $('#chat-saisi');
  if(ch) ch.onkeydown = e=>{
    if(e.key==='Enter' && ch.value.trim()){
      S.canal && S.canal.envoyer('chat', {pseudo:S.moi.pseudo, texte:ch.value.trim().slice(0,120)});
      ch.value='';
    }
  };
  // iPhone ne déclenche pas toujours beforeunload : pagehide couvre les deux
  const partir = ()=>{ try{ avantQuitter(); }catch(e){} if(S.canal) S.canal.quitter(); };
  window.addEventListener('pagehide', partir);
  window.addEventListener('beforeunload', partir);

  // arrivée par un lien d'invitation : on rejoint cette table
  const invit = (new URLSearchParams(location.search).get('table')||'').toUpperCase();
  if(/^[A-Z0-9]{4}$/.test(invit)){
    history.replaceState(null,'',location.pathname);
    // on laisse une seconde au hall pour savoir à quel jeu joue la table
    setTimeout(()=>rejoindreTable(invit, 'roulette'), 1200);
    return;
  }
  // on reprend la table quittée par accident (rechargement, écran verrouillé)
  try{
    const der = JSON.parse(localStorage.getItem('cyc_table')||'null');
    if(der && der.code) rejoindreTable(der.code, der.jeu);
  }catch(e){}
})();
