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
const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function dateFr(iso){ const d=iso.split('-'); return MOIS[+d[1]-1]+' '+d[0]; }

// noms d'actifs : évite de charger les 380 Ko de données sur les pages légères
const ASSET_NAMES = {SPX:'S&P 500', NDX:'Nasdaq Composite', BTC:'Bitcoin'};
const nomActif = k => (window.MARKET_DATA && MARKET_DATA.series[k] ? MARKET_DATA.series[k].nom : (ASSET_NAMES[k]||k));

// halvings Bitcoin réels : panneau d'infos post-reveal
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
const CAPITAL_INIT = 10000;
const MAX_PALIER   = 0.35;   // ← garde-fou : jamais plus de 35 % du cash sur un seul palier
const MAX_VENTE    = 0.50;   // ← une prise de profit ne solde jamais toute la position
const MISSIONS_PAR_NIVEAU = 7;

/* ---------- état global ---------- */
const G = {
  user:null, offline:false, token:null, sbUp:null,
  mode:'simple',              // 'simple' (gestuel, sans texte) ou 'pro' (dense, chiffré)
  prof:{pseudo:'Toi', avatar:null, level:1, xp:0, best:0, missions:0, rounds:0, sessions:0},
  hist:[],
  sc:null, ser:null,
  round:0, cash:CAPITAL_INIT, units:0, cost:0, totSpent:0, totUnits:0,
  actions:[], done:false,
  view:{span:160, scale:'log'}, gateOK:false, maxSpanSeen:0,
  anim:null, revealing:false, base:100, revealPrices:false, showMA:false
};

function missionDone(){ return G.prof.missions % MISSIONS_PAR_NIVEAU; }

/* précision : part des décisions jouées dans une bonne zone.
   Plus lisible que l'XP, qui ne mesure que le temps passé. */
const MIN_DECISIONS = 20;   // en dessous, le pourcentage ne veut rien dire
function precisionDe(p){
  const t = p.rounds||0, b = p.missions||0;
  return t >= MIN_DECISIONS ? Math.round(b/t*100) : null;
}
function niveauDe(m){ return Math.floor(m/MISSIONS_PAR_NIVEAU)+1; }

/* ---------- persistance locale (mode invité + cache hors ligne) ---------- */
function saveLocal(){
  try{
    localStorage.setItem('cyc_prof', JSON.stringify(G.prof));
    localStorage.setItem('cyc_hist', JSON.stringify(G.hist.slice(-60)));
    localStorage.setItem('cyc_mode', G.mode);
  }catch(e){}
}
function loadLocal(){
  try{
    const p = JSON.parse(localStorage.getItem('cyc_prof')||'null');
    if(p) G.prof = {missions:0, rounds:0, sessions:0, best:0, avatar:null, ...p};
    G.hist  = JSON.parse(localStorage.getItem('cyc_hist')||'[]');
    G.token = localStorage.getItem('cyc_tok')||null;
    // un nouveau venu démarre en mode simple ; un habitué garde son dernier choix
    const m = localStorage.getItem('cyc_mode');
    G.mode = m || (G.prof.sessions>0 ? 'pro' : 'simple');
  }catch(e){}
  if(G.prof.missions==null) G.prof.missions=0;
}
loadLocal();

/* ---------- deux modes d'affichage, une seule progression ---------- */
function applyMode(){
  const app = document.getElementById('app'); if(!app) return;
  app.classList.toggle('simple', G.mode==='simple');
  const chip = document.getElementById('chipanon');
  if(chip && !G.revealPrices) chip.innerHTML = G.mode==='simple'
    ? '<span class="q">?</span>'
    : 'ACTIF <span class="q">? ? ?</span> · PÉRIODE MASQUÉE';
  document.querySelectorAll('.modesw b').forEach(b=>b.classList.toggle('on', b.dataset.m===G.mode));
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
    b.onclick = ()=>{ if(G.mode===b.dataset.m) return;
      Audio_.play('click'); setMode(b.dataset.m); };
  });
  applyMode();
}

/* ---------- accès réservé aux comptes ---------- */
function requireAuth(){
  if(G.token) return true;
  location.replace('login.html');
  return false;
}

/* ---------- navigation entre écrans d'une même page ---------- */
function show(id){ $$('.screen').forEach(s=>s.classList.toggle('on', s.id===id)); }
function go(url){ location.href = url; }

/* ---------- service worker : mode hors ligne + installation ---------- */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
