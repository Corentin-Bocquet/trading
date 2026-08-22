/* ============================================================
   CORE : outils, état global, persistance locale
   Chargé sur toutes les pages.
   ============================================================ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v,a,b) => v<a?a:(v>b?b:v);
const fmt  = n => Math.round(n).toLocaleString('fr-FR');
const fmt2 = n => n>=1000 ? Math.round(n).toLocaleString('fr-FR')
                : n>=1 ? n.toFixed(2) : n.toFixed(4);
const dollars = n => (n<0?'−':'') + '$' + fmt(Math.abs(n));
const signe   = n => (n>=0?'+':'−') + fmt(Math.abs(n));
const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function dateFr(iso){ const d=iso.split('-'); return MOIS[+d[1]-1]+' '+d[0]; }

/* ---------- catalogue des actifs (chargé sur les pages de jeu) ---------- */
function nomActif(k){
  if(typeof CATALOGUE!=='undefined' && CATALOGUE.assets[k]) return CATALOGUE.assets[k].nom;
  return ({SPX:'S&P 500', NDX:'Nasdaq Composite', BTC:'Bitcoin'})[k] || k;
}

/* ---------- marchés jouables : un mot par catégorie ---------- */
const MARCHES = [
  {k:'tout',       nom:'TOUT',       phrase:'Un peu de tout : actions, crypto, marchés entiers.'},
  {k:'crypto',     nom:'CRYPTO',     phrase:'Bitcoin, Ethereum et les autres. Ça monte et ça chute très fort.'},
  {k:'indices',    nom:'INDICES',    phrase:'Des marchés entiers d’un coup, comme le S&P 500. Le plus calme.'},
  {k:'geantes',    nom:'GÉANTES',    phrase:'Les plus grosses entreprises du monde : Apple, Amazon, Tesla…'},
  {k:'agitees',    nom:'AGITÉES',    phrase:'Les actions qui chutent et remontent le plus violemment.'},
  {k:'secteur',    nom:'SECTEURS',   phrase:'Un domaine précis : énergie, santé, tech, banque, défense…'},
  {k:'entreprise', nom:'ENTREPRISE', phrase:'Tu choisis l’entreprise. La période, elle, reste cachée.'}
];
const SECTEURS = [
  {k:'tech',     nom:'TECH'},      {k:'energie', nom:'ÉNERGIE'},
  {k:'sante',    nom:'SANTÉ'},     {k:'finance', nom:'BANQUE'},
  {k:'conso',    nom:'CONSO'},     {k:'defense', nom:'DÉFENSE'}
];
const NOM_MARCHE = m => !m ? 'TOUT'
  : m.cat==='secteur'   ? (SECTEURS.find(s=>s.k===m.sous)||{nom:'SECTEURS'}).nom
  : m.cat==='entreprise'? (m.asset ? nomActif(m.asset).toUpperCase() : 'ENTREPRISE')
  : (MARCHES.find(x=>x.k===m.cat)||{nom:'TOUT'}).nom;

/* halvings Bitcoin réels : panneau d'infos post-reveal */
const HALVINGS = ['2012-11-28','2016-07-09','2020-05-11','2024-04-20','2028-04-01'];
function halvingInfo(iso){
  const t = new Date(iso).getTime();
  let last=null, next=null;
  for(const h of HALVINGS){ const ht=new Date(h).getTime(); if(ht<=t) last=h; else if(!next) next=h; }
  return {last, next,
    joursDepuis: last ? Math.round((t-new Date(last).getTime())/864e5) : null,
    joursAvant : next ? Math.round((new Date(next).getTime()-t)/864e5) : null};
}

/* ---------- règles du jeu ---------- */
const CAPITAL_DEPART = 10000;   // tout le monde démarre avec 10 000 $
const SEUIL_RUINE    = 500;     // en dessous, le portefeuille est considéré perdu
const PALIER_SAGE    = 0.35;    // premier repère montré pendant le geste
const PALIER_GROS    = 0.66;    // second repère
const MISSIONS_PAR_NIVEAU = 7;
const MIN_DECISIONS  = 20;      // avant ça, le pourcentage de bonnes décisions ne veut rien dire

/* ---------- état global ---------- */
const G = {
  user:null, offline:false, token:null, sbUp:null,
  mode:'simple',              // 'simple' (gestuel) ou 'pro' (dense)
  gateOn:false,               // obligation de dézoomer : désactivée par défaut
  marche:{cat:'tout'},        // catégorie de marché choisie
  prof:{pseudo:'Toi', avatar:null, level:1, xp:0, best:0, missions:0, rounds:0,
        sessions:0, cash:CAPITAL_DEPART, ruines:0},
  hist:[],
  sc:null, ser:null, capital:CAPITAL_DEPART,
  round:0, cash:CAPITAL_DEPART, units:0, cost:0, totSpent:0, totUnits:0,
  actions:[], done:false,
  view:{span:160, scale:'log'}, gateOK:true, maxSpanSeen:0,
  anim:null, revealing:false, base:100, revealPrices:false, showMA:false
};

function missionDone(){ return G.prof.missions % MISSIONS_PAR_NIVEAU; }
function niveauDe(m){ return Math.floor(m/MISSIONS_PAR_NIVEAU)+1; }

/* bonnes décisions : la qualité, indépendante du temps de jeu */
function precisionDe(p){
  const t = p.rounds||0, b = p.missions||0;
  return t >= MIN_DECISIONS ? Math.round(b/t*100) : null;
}
/* gain total depuis le tout premier cycle, recapitalisations comprises */
function gainDe(p){
  return (p.cash||CAPITAL_DEPART) - CAPITAL_DEPART*(1+(p.ruines||0));
}

/* ---------- persistance locale (cache hors ligne) ---------- */
function saveLocal(){
  try{
    localStorage.setItem('cyc_prof', JSON.stringify(G.prof));
    localStorage.setItem('cyc_hist', JSON.stringify(G.hist.slice(-60)));
    localStorage.setItem('cyc_mode', G.mode);
    localStorage.setItem('cyc_gate', G.gateOn?'1':'0');
    localStorage.setItem('cyc_marche', JSON.stringify(G.marche));
  }catch(e){}
}
function loadLocal(){
  try{
    const p = JSON.parse(localStorage.getItem('cyc_prof')||'null');
    if(p) G.prof = {missions:0, rounds:0, sessions:0, best:0, avatar:null,
                    cash:CAPITAL_DEPART, ruines:0, ...p};
    G.hist  = JSON.parse(localStorage.getItem('cyc_hist')||'[]');
    G.token = localStorage.getItem('cyc_tok')||null;
    const m = localStorage.getItem('cyc_mode');
    G.mode = m || (G.prof.sessions>0 ? 'pro' : 'simple');
    G.gateOn = localStorage.getItem('cyc_gate') === '1';
    const mk = localStorage.getItem('cyc_marche');
    if(mk) G.marche = JSON.parse(mk);
  }catch(e){}
  if(G.prof.missions==null) G.prof.missions = 0;
  if(G.prof.cash==null) G.prof.cash = CAPITAL_DEPART;
}
loadLocal();

/* ---------- deux affichages, une seule progression ---------- */
function applyMode(){
  const app = document.getElementById('app'); if(!app) return;
  app.classList.toggle('simple', G.mode==='simple');
  document.querySelectorAll('.modesw b').forEach(b=>b.classList.toggle('on', b.dataset.m===G.mode));
  const chip = document.getElementById('chipanon');
  if(chip && !G.revealPrices) chip.innerHTML = G.mode==='simple'
    ? '<span class="q">?</span>'
    : 'ACTIF <span class="q">? ? ?</span> · PÉRIODE MASQUÉE';
}
function setMode(m){
  G.mode = m; saveLocal(); applyMode();
  if(typeof Chart!=='undefined' && G.sc){ Chart.resize(); Chart.draw(); }
  if(typeof updateHUD==='function' && G.sc) updateHUD();
  if(typeof updateGate==='function' && G.sc) updateGate();
  if(typeof resetCardFace==='function') resetCardFace();
}
function wireModeSwitch(){
  document.querySelectorAll('.modesw b').forEach(b=>{
    b.onclick = ()=>{ if(G.mode===b.dataset.m) return; Audio_.play('click'); setMode(b.dataset.m); };
  });
  applyMode();
}

/* ---------- accès réservé aux comptes ---------- */
function requireAuth(){
  if(G.token) return true;
  location.replace('login.html');
  return false;
}

/* ---------- navigation ---------- */
function show(id){ $$('.screen').forEach(s=>s.classList.toggle('on', s.id===id)); }
function go(url){ location.href = url; }

/* ---------- chargement à la demande des séries de prix ---------- */
function chargerSerie(key){
  return new Promise((res,rej)=>{
    if(typeof SERIES!=='undefined' && SERIES[key]) return res(SERIES[key]);
    const s = document.createElement('script');
    s.src = 'assets/data/S_'+key+'.js';
    s.onload  = ()=> (typeof SERIES!=='undefined' && SERIES[key]) ? res(SERIES[key]) : rej(new Error('série vide : '+key));
    s.onerror = ()=> rej(new Error('série introuvable : '+key));
    document.head.appendChild(s);
  });
}

/* ---------- service worker : hors connexion + installation ---------- */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
