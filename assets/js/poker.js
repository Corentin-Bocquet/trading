/* ============================================================
   POKER — TEXAS HOLD'EM
   Table de 4 : toi et trois adversaires. Blindes 5 et 10.
   Le paquet est mélangé au générateur cryptographique, personne
   ne voit les cartes des autres avant l'abattage.
   ============================================================ */

/* ---------- valeur d'une main de 5 cartes ---------- */
const ORDRE = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const NOM_MAIN = ['Carte haute','Paire','Double paire','Brelan','Quinte','Couleur',
                  'Full','Carré','Quinte flush'];

function classe5(cartes){
  const v = cartes.map(c=>ORDRE[c.v]).sort((a,b)=>b-a);
  const couleur = cartes.every(c=>c.co===cartes[0].co);
  const cpt = {}; v.forEach(x=>cpt[x]=(cpt[x]||0)+1);
  const groupes = Object.entries(cpt).map(([x,n])=>[n,+x])
    .sort((a,b)=> b[0]-a[0] || b[1]-a[1]);
  // quinte, en tenant compte de l'as bas (A 2 3 4 5)
  const uniq = [...new Set(v)];
  let suite = 0;
  if(uniq.length===5){
    if(uniq[0]-uniq[4]===4) suite = uniq[0];
    else if(uniq[0]===14 && uniq[1]===5 && uniq[4]===2) suite = 5;
  }
  if(couleur && suite) return [8, suite];
  if(groupes[0][0]===4) return [7, groupes[0][1], groupes[1][1]];
  if(groupes[0][0]===3 && groupes[1][0]===2) return [6, groupes[0][1], groupes[1][1]];
  if(couleur) return [5, ...v];
  if(suite) return [4, suite];
  if(groupes[0][0]===3) return [3, groupes[0][1], ...groupes.slice(1).map(g=>g[1])];
  if(groupes[0][0]===2 && groupes[1][0]===2) return [2, groupes[0][1], groupes[1][1], groupes[2][1]];
  if(groupes[0][0]===2) return [1, groupes[0][1], ...groupes.slice(1).map(g=>g[1])];
  return [0, ...v];
}
function compare(a,b){ for(let i=0;i<Math.max(a.length,b.length);i++){
  const d=(a[i]||0)-(b[i]||0); if(d) return d; } return 0; }

/* meilleure main parmi 7 cartes : on essaie les 21 combinaisons */
function meilleure7(cartes){
  let best=null;
  for(let a=0;a<cartes.length-4;a++)
   for(let b=a+1;b<cartes.length-3;b++)
    for(let c=b+1;c<cartes.length-2;c++)
     for(let d=c+1;d<cartes.length-1;d++)
      for(let e=d+1;e<cartes.length;e++){
        const r=classe5([cartes[a],cartes[b],cartes[c],cartes[d],cartes[e]]);
        if(!best || compare(r,best)>0) best=r;
      }
  return best;
}

/* ---------- état de la table ---------- */
const PK = {
  blinde:10, sabot:[], commune:[], pot:0, tour:'', // preflop flop turn river abattage
  joueurs:[], bouton:0, mise:0, relanceMin:0, actif:0, dernierRelanceur:0, fini:true
};
const NOMS_BOTS = ['Nadia','Bruno','Salim'];

function nouvelleTable(){
  PK.joueurs = [
    {nom:'Toi', humain:true, tapis:Math.max(20, Math.round(G.prof.cashPk)), main:[], engage:0, couche:false, allin:false},
    ...NOMS_BOTS.map(n=>({nom:n, humain:false, tapis:500, main:[], engage:0, couche:false, allin:false}))
  ];
  PK.bouton = 0;
}

function nouvelleMain(){
  if(PK.joueurs[0].tapis < PK.blinde){
    PK.joueurs[0].tapis = PK_DEPART;
    G.prof.ruinesPk = (G.prof.ruinesPk||0)+1; G.prof.cashPk = PK_DEPART;
    messagePK('Tu as tout perdu. Cave remise à ' + PK_DEPART + ' €.');
  }
  PK.joueurs.forEach(j=>{ if(j.tapis<=0) j.tapis = 500; });   // les adversaires se recavent
  PK.sabot = nouveauSabot(1);
  PK.commune = []; PK.pot = 0; PK.tour='preflop'; PK.fini=false;
  PK.bouton = (PK.bouton+1) % 4;
  PK.joueurs.forEach(j=>{ j.main=[PK.sabot.pop(), PK.sabot.pop()];
    j.engage=0; j.couche=false; j.allin=false; j.mise=0; });

  const pb = (PK.bouton+1)%4, gb = (PK.bouton+2)%4;
  engager(pb, Math.floor(PK.blinde/2));
  engager(gb, PK.blinde);
  PK.mise = PK.blinde; PK.relanceMin = PK.blinde;
  PK.dernierRelanceur = gb;
  PK.actif = (gb+1)%4;
  Audio_.play('swipe');
  peindrePK();
  setTimeout(tourDeJeu, 500);
}

function engager(i, m){
  const j = PK.joueurs[i];
  const v = Math.min(m, j.tapis);
  j.tapis -= v; j.engage += v; PK.pot += v;
  if(j.tapis===0) j.allin = true;
}

const enJeu = () => PK.joueurs.filter(j=>!j.couche);
const peuventParler = () => PK.joueurs.filter(j=>!j.couche && !j.allin);

/* ---------- boucle de jeu ---------- */
function tourDeJeu(){
  if(PK.fini) return;
  if(enJeu().length === 1){ finirMain(); return; }
  // tout le monde a parlé et égalisé ?
  const restants = peuventParler();
  const tousEgaux = restants.every(j=>j.engage===PK.mise || j.allin);
  if(restants.length<=1 && tousEgaux){ etapeSuivante(); return; }
  if(tousEgaux && PK.aParle >= restants.length){ etapeSuivante(); return; }

  const j = PK.joueurs[PK.actif];
  if(j.couche || j.allin){ PK.actif=(PK.actif+1)%4; return tourDeJeu(); }
  if(j.humain){ peindrePK(); return; }          // on attend le clic
  setTimeout(()=>jouerBot(PK.actif), 700 + Math.random()*500);
}

function avancer(){
  PK.aParle = (PK.aParle||0) + 1;
  PK.actif = (PK.actif+1)%4;
  peindrePK();
  setTimeout(tourDeJeu, 250);
}

function actionSuivre(i){
  const j = PK.joueurs[i], d = PK.mise - j.engage;
  engager(i, d);
  Audio_.play(d>0?'coin':'click');
  avancer();
}
function actionCoucher(i){ PK.joueurs[i].couche = true; Audio_.play('click'); avancer(); }
function actionRelancer(i, montant){
  const j = PK.joueurs[i];
  const cible = Math.min(j.engage + j.tapis, Math.max(PK.mise + PK.relanceMin, montant));
  engager(i, cible - j.engage);
  PK.relanceMin = Math.max(PK.relanceMin, cible - PK.mise);
  PK.mise = Math.max(PK.mise, j.engage);
  PK.dernierRelanceur = i; PK.aParle = 0;
  Audio_.play('coin');
  avancer();
}

function etapeSuivante(){
  PK.joueurs.forEach(j=>{ j.engage = 0; });
  PK.mise = 0; PK.relanceMin = PK.blinde; PK.aParle = 0;
  if(PK.tour==='preflop'){ PK.tour='flop'; PK.commune.push(PK.sabot.pop(),PK.sabot.pop(),PK.sabot.pop()); }
  else if(PK.tour==='flop'){ PK.tour='turn'; PK.commune.push(PK.sabot.pop()); }
  else if(PK.tour==='turn'){ PK.tour='river'; PK.commune.push(PK.sabot.pop()); }
  else { finirMain(); return; }
  Audio_.play('click');
  PK.actif = (PK.bouton+1)%4;
  peindrePK();
  setTimeout(tourDeJeu, 700);
}

/* ---------- abattage et partage du pot, pots secondaires compris ---------- */
function finirMain(){
  PK.fini = true; PK.tour = 'abattage';
  while(PK.commune.length<5 && enJeu().length>1) PK.commune.push(PK.sabot.pop());

  const avant = PK.joueurs[0].tapis;
  const mises = PK.joueurs.map(j=>({j, total:j.total||0}));
  // on recalcule les engagements totaux de la main
  const engages = PK.joueurs.map(j=>j.totalEngage||0);

  const restants = enJeu();
  let lignes = [];
  if(restants.length===1){
    restants[0].tapis += PK.pot;
    lignes.push(restants[0].nom + ' remporte ' + PK.pot + ' € (tout le monde s\'est couché)');
  }else{
    const forces = new Map();
    restants.forEach(j=>forces.set(j, meilleure7([...j.main, ...PK.commune])));
    let best=null; restants.forEach(j=>{ const f=forces.get(j); if(!best||compare(f,best)>0) best=f; });
    const gagnants = restants.filter(j=>compare(forces.get(j),best)===0);
    const part = Math.floor(PK.pot/gagnants.length);
    gagnants.forEach(j=> j.tapis += part);
    lignes.push(gagnants.map(j=>j.nom).join(' et ') + ' : ' + NOM_MAIN[best[0]]
      + ' — ' + PK.pot + ' €');
  }

  G.prof.cashPk = Math.max(0, Math.round(PK.joueurs[0].tapis));
  G.prof.mainsPk = (G.prof.mainsPk||0)+1;
  const delta = PK.joueurs[0].tapis - avant;
  majSerie(); saveLocal(); Cloud.saveJeu('poker');
  Audio_.play(delta>0?'win':'fail');
  peindrePK(lignes.join(' · '), delta);
}

/* ---------- adversaires ---------- */
function forceMain(j){
  if(PK.commune.length===0){
    const [a,b]=j.main, va=ORDRE[a.v], vb=ORDRE[b.v];
    const paire = va===vb, assortie = a.co===b.co;
    let f = (Math.max(va,vb) + Math.min(va,vb)*0.5)/21;
    if(paire) f += .35; if(assortie) f += .08;
    if(Math.abs(va-vb)<=2 && !paire) f += .05;
    return Math.min(1, f);
  }
  const r = meilleure7([...j.main, ...PK.commune]);
  return Math.min(1, r[0]/8 + 0.06);
}
function jouerBot(i){
  const j = PK.joueurs[i];
  if(j.couche || j.allin){ avancer(); return; }
  const f = forceMain(j) + (Math.random()-0.5)*0.16;
  const aPayer = PK.mise - j.engage;
  const cotePot = aPayer / Math.max(1, PK.pot + aPayer);
  if(aPayer > 0 && f < 0.30 + cotePot*0.5){ actionCoucher(i); return; }
  if(f > 0.62 && Math.random() < 0.55){
    actionRelancer(i, PK.mise + PK.relanceMin + Math.round(PK.pot*0.4));
    return;
  }
  actionSuivre(i);
}

/* ---------- affichage ---------- */
function messagePK(t){
  const e=$('#pk-msg'); e.textContent=t; e.classList.add('on');
  clearTimeout(window._pm); window._pm=setTimeout(()=>e.classList.remove('on'),3000);
}

function peindrePK(resume, delta){
  $('#pk-pot').textContent = PK.pot + ' €';
  $('#pk-tour').textContent = ({preflop:'PRÉFLOP',flop:'FLOP',turn:'TURN',river:'RIVER',abattage:'ABATTAGE'})[PK.tour]||'';
  $('#pk-commune').innerHTML = PK.commune.map(c=>carteHTML(c)).join('')
    || '<span class="note" style="align-self:center">cartes communes à venir</span>';

  $('#pk-bots').innerHTML = PK.joueurs.slice(1).map((j,k)=>{
    const i = k+1;
    const montre = PK.tour==='abattage' && !j.couche;
    return `<div class="pkbot${j.couche?' couche':''}${PK.actif===i&&!PK.fini?' actif':''}">
      <div class="pknom">${j.nom}${i===PK.bouton?' <s class="bouton">D</s>':''}</div>
      <div class="cartes mini">${j.main.map(c=>carteHTML(c, !montre)).join('')}</div>
      <div class="pktapis">${fmt(j.tapis)} €${j.engage?` · mise ${j.engage} €`:''}${j.couche?' · couché':''}</div>
    </div>`;
  }).join('');

  const moi = PK.joueurs[0];
  $('#pk-main').innerHTML = moi.main.map(c=>carteHTML(c)).join('');
  $('#pk-tapis').textContent = fmt(moi.tapis)+' €';
  $('#pk-engage').textContent = moi.engage ? moi.engage+' €' : '—';
  $('#pk-force').textContent = PK.commune.length && !moi.couche
    ? NOM_MAIN[meilleure7([...moi.main, ...PK.commune])[0]] : '';

  const monTour = !PK.fini && PK.actif===0 && !moi.couche && !moi.allin;
  $('#pk-actions').style.display = monTour ? '' : 'none';
  $('#pk-nouvelle').style.display = PK.fini ? '' : 'none';
  if(monTour){
    const aPayer = PK.mise - moi.engage;
    $('#b-suivre').textContent = aPayer>0 ? `SUIVRE ${aPayer} €` : 'PARLER';
    $('#b-coucher').style.display = aPayer>0 ? '' : 'none';
    const relance = PK.mise + PK.relanceMin;
    $('#b-relancer').textContent = `RELANCER À ${Math.min(relance, moi.engage+moi.tapis)} €`;
    $('#b-tapis').textContent = `TAPIS ${fmt(moi.tapis)} €`;
  }
  $('#pk-resume').innerHTML = resume
    ? `<b class="${delta>0?'pos':delta<0?'neg':''}">${delta>0?'+'+fmt(delta):fmt(delta)} €</b><span>${resume}</span>`
    : '';
  $('#pk-solde').textContent = fmt(G.prof.cashPk)+' €';
  $('#pk-mains').textContent = fmt(G.prof.mainsPk||0);
  $('#ruine-pk').classList.toggle('on', G.prof.cashPk===PK_DEPART && (G.prof.ruinesPk||0)>0 && PK.fini);
}

/* ---------- amorçage ---------- */
(function bootPK(){
  if(!requireAuth()) return;
  wireModeSwitch();
  $('#b-suivre').onclick   = ()=>{ Audio_.wake(); actionSuivre(0); };
  $('#b-coucher').onclick  = ()=>actionCoucher(0);
  $('#b-relancer').onclick = ()=>actionRelancer(0, PK.mise + PK.relanceMin);
  $('#b-tapis').onclick    = ()=>actionRelancer(0, PK.joueurs[0].engage + PK.joueurs[0].tapis);
  $('#pk-nouvelle').onclick= ()=>{ Audio_.wake(); nouvelleMain(); };
  $('#b-sound').onclick = ()=>{ const on=Audio_.toggle();
    $('#b-sound').textContent = on?'SON':'MUET'; $('#b-sound').classList.toggle('off',!on); };
  if(!Audio_.isOn()){ $('#b-sound').textContent='MUET'; $('#b-sound').classList.add('off'); }

  (async()=>{
    if(G.token){ try{ await Cloud.restore(); }catch(e){} }
    nouvelleTable(); PK.fini = true; peindrePK();
  })();
})();
