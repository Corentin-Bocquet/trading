/* ============================================================
   LES TROIS JEUX EN LIGNE
   L'hôte détient l'état, applique les actions reçues et rediffuse
   l'état complet. Les autres n'affichent et n'envoient que des
   actions : impossible de désynchroniser durablement.
   ============================================================ */

const ordreJoueurs = () => S.joueurs.map(j=>j.id);
const pseudoDe = id => (S.joueurs.find(j=>j.id===id)||{}).pseudo || '?';
const avatarDe = id => (S.joueurs.find(j=>j.id===id)||{}).avatar || null;

/* ================= L'HÔTE ARBITRE ================= */
function hoteVerifie(){
  if(!S.etat || S.etat.jeu !== S.jeu){ S.etat = etatNeuf(); diffuserEtat(); return; }
  // un joueur est parti en plein tour : on le retire proprement
  const presents = new Set(ordreJoueurs());
  let change = false;
  for(const id of Object.keys(S.etat.joueurs||{})){
    if(!presents.has(id)){ delete S.etat.joueurs[id]; change = true; }
  }
  if(S.etat.tour && !presents.has(S.etat.tour)){ S.etat.tour = null; change = true; auto(); }
  if(change) diffuserEtat();
  reprendreLaMain();
}

/* Si l'hôte précédent est parti au milieu d'un tour, ses minuteries sont
   parties avec lui. Le nouvel hôte relance la table au lieu de la laisser
   figée sur « rien ne va plus ». */
let reprise = null;
function reprendreLaMain(){
  const bloque = ['tourne','resultat','croupier','fini'];
  if(!S.etat || !bloque.includes(S.etat.phase)){ clearTimeout(reprise); reprise = null; return; }
  if(reprise) return;
  reprise = setTimeout(()=>{
    reprise = null;
    if(!estHote() || !S.etat || !bloque.includes(S.etat.phase)) return;
    if(S.jeu==='poker'){
      const jouables = ordreJoueurs().filter(id=>S.etat.joueurs[id] && S.etat.joueurs[id].tapis>=BLINDE);
      if(jouables.length>=2){ distribuerPK(); return; }
    }
    S.etat = etatNeuf(); diffuserEtat();
  }, 12000);
}

function etatNeuf(){
  const base = {jeu:S.jeu, phase:'mises', joueurs:{}, tour:null, message:''};
  if(S.jeu==='roulette') return Object.assign(base, {numero:null, depart:0});
  if(S.jeu==='blackjack') return Object.assign(base, {croupier:[], cache:true, resultats:null});
  return Object.assign(base, {commune:[], pot:0, mise:0, relanceMin:10, bouton:null,
                              mains:{}, abattage:null, resume:''});
}

function hoteAction(de, a){
  if(!S.etat) S.etat = etatNeuf();
  const f = ({roulette:actionRoulette, blackjack:actionBlackjack, poker:actionPoker})[S.jeu];
  if(f) f(de, a);
}
function auto(){
  const f = ({blackjack:autoBlackjack, poker:autoPoker})[S.jeu];
  if(f) f();
}

/* ================= ROULETTE EN LIGNE ================= */
let sabotEnLigne = [];

function actionRoulette(de, a){
  const e = S.etat;
  if(a.type==='mise' && e.phase==='mises'){
    e.joueurs[de] = e.joueurs[de] || {mises:{}, total:0};
    const j = e.joueurs[de];
    j.mises[a.cle] = (j.mises[a.cle]||0) + a.montant;
    j.total += a.montant;
    diffuserEtat();
  }
  else if(a.type==='vider' && e.phase==='mises'){
    e.joueurs[de] = {mises:{}, total:0}; diffuserEtat();
  }
  else if(a.type==='lancer' && e.phase==='mises' && de===S.hote){
    e.numero = tirageAleatoire();
    e.depart = Math.random()*Math.PI*2;
    e.phase = 'tourne';
    diffuserEtat();
    // on relit toujours S.etat : l'objet a pu être remplacé entre-temps
    setTimeout(()=>{ if(!estHote() || !S.etat || S.etat.phase!=='tourne') return;
      S.etat.phase='resultat'; diffuserEtat();
      setTimeout(()=>{ if(!estHote() || !S.etat || S.etat.phase!=='resultat') return;
        S.etat = etatNeuf(); diffuserEtat(); }, 7000);
    }, 6400);
  }
}

/* ================= BLACKJACK EN LIGNE ================= */
function piocheEnLigne(){
  if(sabotEnLigne.length < 60) sabotEnLigne = nouveauSabot(6);
  return sabotEnLigne.pop();
}

function actionBlackjack(de, a){
  const e = S.etat;
  if(a.type==='mise' && e.phase==='mises'){
    e.joueurs[de] = {mise:a.montant, cartes:[], finie:false};
    diffuserEtat();
    const tous = ordreJoueurs();
    const prets = tous.filter(id=>e.joueurs[id] && e.joueurs[id].mise>0);
    if(prets.length===tous.length && tous.length>0) setTimeout(distribuerBJ, 900);
  }
  else if(e.phase==='jeu' && e.tour===de){
    const m = e.joueurs[de]; if(!m) return;
    if(a.type==='tirer'){ m.cartes.push(piocheEnLigne());
      if(pointsBJ(m.cartes).total>=21) m.finie=true; }
    else if(a.type==='rester'){ m.finie = true; }
    else if(a.type==='doubler' && m.cartes.length===2){
      m.mise *= 2; m.doublee = true; m.cartes.push(piocheEnLigne()); m.finie = true; }
    diffuserEtat(); autoBlackjack();
  }
}

function distribuerBJ(){
  if(!estHote()) return;
  const e = S.etat;
  ordreJoueurs().forEach(id=>{
    if(!e.joueurs[id]) e.joueurs[id] = {mise:0, cartes:[], finie:true};
    e.joueurs[id].cartes = [piocheEnLigne(), piocheEnLigne()];
    e.joueurs[id].finie = pointsBJ(e.joueurs[id].cartes).total===21 || e.joueurs[id].mise<=0;
  });
  e.croupier = [piocheEnLigne(), piocheEnLigne()];
  e.cache = true; e.phase = 'jeu';
  e.tour = ordreJoueurs().find(id=>!e.joueurs[id].finie) || null;
  diffuserEtat();
  if(!e.tour) finirBJ();
}

function autoBlackjack(){
  if(!estHote()) return;
  const e = S.etat; if(e.phase!=='jeu') return;
  const suivant = ordreJoueurs().find(id=>e.joueurs[id] && !e.joueurs[id].finie);
  if(suivant){ e.tour = suivant; diffuserEtat(); }
  else finirBJ();
}

function finirBJ(){
  const e = S.etat;
  e.phase='croupier'; e.cache=false; e.tour=null; diffuserEtat();
  const joue = Object.values(e.joueurs).some(m=>m.mise>0 && pointsBJ(m.cartes).total<=21);
  const etape = ()=>{
    if(!estHote()) return;
    if(joue && pointsBJ(e.croupier).total < 17){
      e.croupier.push(piocheEnLigne()); diffuserEtat(); setTimeout(etape, 700);
    }else{
      const pc = pointsBJ(e.croupier).total, bjC = estBJ(e.croupier);
      e.resultats = {};
      for(const id in e.joueurs){
        const m = e.joueurs[id]; if(m.mise<=0){ e.resultats[id]={r:'—',g:0}; continue; }
        const pj = pointsBJ(m.cartes).total, bjJ = estBJ(m.cartes);
        let r='PERDU', g=0;
        if(pj>21) r='PERDU';
        else if(bjJ && !bjC){ g = m.mise + Math.round(m.mise*1.5); r='BLACKJACK'; }
        else if(bjC && !bjJ) r='PERDU';
        else if(pc>21 || pj>pc){ g = m.mise*2; r='GAGNÉ'; }
        else if(pj===pc){ g = m.mise; r='ÉGALITÉ'; }
        e.resultats[id] = {r, g, net:g-m.mise};
      }
      e.phase='fini'; diffuserEtat();
      setTimeout(()=>{ if(!estHote()) return;
        S.etat = etatNeuf(); diffuserEtat(); }, 8000);
    }
  };
  setTimeout(etape, 900);
}

/* ================= POKER EN LIGNE ================= */
const BLINDE = 10;

async function actionPoker(de, a){
  const e = S.etat;
  if(a.type==='asseoir' && e.phase==='mises'){
    e.joueurs[de] = {tapis: Math.max(BLINDE*2, Math.min(500, a.cave|0)), engage:0, total:0,
                     couche:false, allin:false, assis:true};
    diffuserEtat();
    const assis = Object.keys(e.joueurs).length;
    if(assis>=2 && assis===ordreJoueurs().length) setTimeout(()=>distribuerPK(), 1200);
  }
  else if(a.type==='demarrer' && de===S.hote && e.phase==='mises'){
    if(Object.keys(e.joueurs).length>=2) distribuerPK();
  }
  else if(e.phase==='encheres' && e.tour===de){
    const j = e.joueurs[de]; if(!j) return;
    if(a.type==='coucher'){ j.couche = true; }
    else if(a.type==='suivre'){ miserPK(de, e.mise - j.engage); }
    else if(a.type==='relancer'){ miserPK(de, Math.max(e.mise + e.relanceMin, a.montant) - j.engage); }
    else if(a.type==='tapis'){ miserPK(de, j.tapis); }
    e.aParle = (e.aParle||0)+1;
    diffuserEtat(); autoPoker();
  }
}

function miserPK(id, m){
  const e = S.etat, j = e.joueurs[id];
  const v = Math.max(0, Math.min(m, j.tapis));
  j.tapis -= v; j.engage += v; j.total += v; e.pot += v;
  if(j.tapis===0) j.allin = true;
  if(j.engage > e.mise){ e.relanceMin = Math.max(e.relanceMin, j.engage - e.mise);
                         e.mise = j.engage; e.aParle = 0; }
}

async function distribuerPK(){
  if(!estHote()) return;
  const e = S.etat;
  const ids = ordreJoueurs().filter(id=>e.joueurs[id]);
  if(ids.length<2) return;
  sabotEnLigne = nouveauSabot(1);
  e.commune=[]; e.pot=0; e.mise=0; e.relanceMin=BLINDE; e.aParle=0; e.abattage=null; e.resume='';
  e.bouton = ids[(ids.indexOf(e.bouton)+1) % ids.length] || ids[0];
  e.mains = {};
  const clair = {};
  for(const id of ids){
    const j = e.joueurs[id];
    j.engage=0; j.total=0; j.couche=false; j.allin=false;
    clair[id] = [sabotEnLigne.pop(), sabotEnLigne.pop()];
    const pub = (S.joueurs.find(x=>x.id===id)||{}).pub;
    e.mains[id] = pub ? await chiffrerPour(pub, clair[id]) : null;
  }
  S.clairHote = clair;                       // l'hôte garde le clair pour l'abattage
  const i = ids.indexOf(e.bouton);
  // en tête-à-tête, le bouton paie la petite blinde et parle le premier
  const pb = ids.length===2 ? ids[i] : ids[(i+1)%ids.length];
  const gb = ids.length===2 ? ids[(i+1)%2] : ids[(i+2)%ids.length];
  miserPK(pb, Math.floor(BLINDE/2)); miserPK(gb, BLINDE);
  e.mise = BLINDE; e.relanceMin = BLINDE; e.aParle = 0;
  e.tour = ids[(ids.indexOf(gb)+1)%ids.length];
  e.phase = 'encheres'; e.tourNom = 'PRÉFLOP';
  diffuserEtat();
}

function autoPoker(){
  if(!estHote()) return;
  const e = S.etat; if(e.phase!=='encheres') return;
  const ids = ordreJoueurs().filter(id=>e.joueurs[id]);
  const vivants = ids.filter(id=>!e.joueurs[id].couche);
  if(vivants.length<=1){ abattagePK(); return; }
  const parlants = vivants.filter(id=>!e.joueurs[id].allin);
  const egaux = parlants.every(id=>e.joueurs[id].engage===e.mise);
  if(parlants.length<=1 && egaux){ etapePK(); return; }
  if(egaux && (e.aParle||0) >= parlants.length){ etapePK(); return; }
  let i = ids.indexOf(e.tour);
  for(let k=1;k<=ids.length;k++){
    const id = ids[(i+k)%ids.length];
    if(!e.joueurs[id].couche && !e.joueurs[id].allin){ e.tour = id; diffuserEtat(); return; }
  }
  etapePK();
}

function etapePK(){
  const e = S.etat;
  Object.values(e.joueurs).forEach(j=>{ j.engage = 0; });
  e.mise = 0; e.relanceMin = BLINDE; e.aParle = 0;
  if(e.commune.length===0){ e.commune.push(piochePK(),piochePK(),piochePK()); e.tourNom='FLOP'; }
  else if(e.commune.length===3){ e.commune.push(piochePK()); e.tourNom='TURN'; }
  else if(e.commune.length===4){ e.commune.push(piochePK()); e.tourNom='RIVER'; }
  else { abattagePK(); return; }
  // après le flop, c'est au premier joueur à gauche du bouton de parler
  const tous = ordreJoueurs().filter(id=>e.joueurs[id]);
  const d = tous.indexOf(e.bouton);
  let prem = null;
  for(let k=1;k<=tous.length;k++){
    const id = tous[(d+k)%tous.length];
    if(!e.joueurs[id].couche && !e.joueurs[id].allin){ prem = id; break; }
  }
  e.tour = prem;
  diffuserEtat();
  if(!e.tour) setTimeout(etapePK, 900);
}
const piochePK = () => sabotEnLigne.pop();

function abattagePK(){
  const e = S.etat;
  const ids = ordreJoueurs().filter(id=>e.joueurs[id]);
  const vivants = ids.filter(id=>!e.joueurs[id].couche);
  while(e.commune.length<5 && vivants.length>1) e.commune.push(piochePK());

  const forces = {};
  if(e.commune.length===5)
    vivants.forEach(id=>{ forces[id] = meilleure7([...(S.clairHote[id]||[]), ...e.commune]); });

  const paliers = [...new Set(ids.map(id=>e.joueurs[id].total).filter(t=>t>0))].sort((a,b)=>a-b);
  let precedent = 0; const lignes = [];
  paliers.forEach(niv=>{
    const contrib = ids.filter(id=>e.joueurs[id].total >= niv);
    const montant = (niv-precedent)*contrib.length; precedent = niv;
    if(montant<=0) return;
    const elig = contrib.filter(id=>!e.joueurs[id].couche);
    if(!elig.length){ const part=Math.floor(montant/contrib.length);
      contrib.forEach(id=>e.joueurs[id].tapis += part); return; }
    let best=null;
    elig.forEach(id=>{ const f=forces[id]; if(f && (!best||compare(f,best)>0)) best=f; });
    const gagnants = best ? elig.filter(id=>compare(forces[id],best)===0) : elig;
    const part = Math.floor(montant/gagnants.length), reste = montant - part*gagnants.length;
    gagnants.forEach((id,k)=>{ e.joueurs[id].tapis += part + (k===0?reste:0); });
    lignes.push(gagnants.map(pseudoDe).join(' et ')
      + (best ? ' : '+NOM_MAIN[best[0]] : ' remporte') + ' — ' + montant + ' €');
  });
  e.pot = 0;
  e.abattage = {}; vivants.forEach(id=>{ e.abattage[id] = S.clairHote[id]||[]; });
  e.resume = lignes.join(' · ');
  e.phase = 'fini'; e.tour = null;
  diffuserEtat();
  setTimeout(()=>{ if(!estHote()) return;
    const restants = ordreJoueurs().filter(id=>e.joueurs[id]);
    restants.forEach(id=>{ if(e.joueurs[id].tapis < BLINDE) e.joueurs[id].tapis = 0; });
    const jouables = restants.filter(id=>e.joueurs[id].tapis >= BLINDE);
    if(jouables.length>=2) distribuerPK();
    else { S.etat = etatNeuf(); diffuserEtat(); }
  }, 9000);
}

/* ================= APPLICATION DE L'ÉTAT CHEZ CHACUN ================= */
let dejaRegle = '', dejaAnime = '';
async function appliquerEtat(e){
  if(!e) return;
  // l'animation est là pour le spectacle ; le règlement, lui, suit l'état
  // diffusé par l'hôte, sinon un onglet en arrière-plan ne serait jamais payé
  if(e.jeu==='roulette' && e.phase==='tourne' && dejaAnime !== e.numero+'@'+e.depart){
    dejaAnime = e.numero+'@'+e.depart;
    animerRoue(e.numero, e.depart);
  }
  if(e.jeu==='roulette' && e.phase==='resultat' && dejaRegle !== 'rl'+e.numero+'@'+e.depart){
    dejaRegle = 'rl'+e.numero+'@'+e.depart;
    reglerRoulette(e);
  }
  if(e.jeu==='blackjack' && e.phase==='fini' && e.resultats && dejaRegle !== 'bj'+JSON.stringify(e.resultats)){
    dejaRegle = 'bj'+JSON.stringify(e.resultats);
    reglerBlackjack(e);
  }
  if(e.jeu==='poker' && e.phase==='fini' && dejaRegle !== 'pk'+e.resume+e.commune.length){
    dejaRegle = 'pk'+e.resume+e.commune.length;
    reglerPoker(e);
  }
  if(e.jeu==='poker' && e.mains && e.mains[S.moi.id] && S.maChiffree !== e.mains[S.moi.id]){
    S.maChiffree = e.mains[S.moi.id];
    try{ S.maMain = await dechiffrer(e.mains[S.moi.id]); }catch(err){ S.maMain = null; }
  }
  peindreJeu();
}

function reglerRoulette(e){
  const m = (e.joueurs[S.moi.id]||{}).mises || {};
  let gain = 0;
  for(const cle in m){ const g = gainMise(cle, e.numero); if(g>0) gain += m[cle]*(g+1); }
  if(gain>0){ G.prof.cashRl += gain; Audio_.play('win'); Audio_.play('coin'); }
  else if(Object.keys(m).length) Audio_.play('fail');
  G.prof.toursRl = (G.prof.toursRl||0)+1;
  G.prof.spins = (G.prof.spins||[]); G.prof.spins.push(e.numero);
  if(G.prof.spins.length > 10000) G.prof.spins = G.prof.spins.slice(-10000);
  if(G.prof.cashRl < 1){ G.prof.ruinesRl=(G.prof.ruinesRl||0)+1; G.prof.cashRl = RL_DEPART; }
  majSerie(); saveLocal(); Cloud.saveRoulette();
  seDeclarerPret(false);          // la caisse affichée aux autres est à jour
}
function reglerBlackjack(e){
  const r = e.resultats[S.moi.id];
  if(r){ G.prof.cashBj += r.g; G.prof.mainsBj = (G.prof.mainsBj||0)+1;
    Audio_.play(r.net>0?'win':r.net<0?'fail':'ok');
    if(G.prof.cashBj < 5){ G.prof.ruinesBj=(G.prof.ruinesBj||0)+1; G.prof.cashBj = BJ_DEPART; }
    majSerie(); saveLocal(); Cloud.saveJeu('blackjack'); }
  seDeclarerPret(false);
}
function reglerPoker(e){
  const j = e.joueurs[S.moi.id];
  if(j){ G.prof.cashPk = Math.max(0, Math.round((S.horsTable||0) + j.tapis));
    G.prof.mainsPk = (G.prof.mainsPk||0)+1;
    if(G.prof.cashPk < BLINDE){ G.prof.ruinesPk=(G.prof.ruinesPk||0)+1; G.prof.cashPk = PK_DEPART; }
    majSerie(); saveLocal(); Cloud.saveJeu('poker'); }
}
