/* ============================================================
   BLACKJACK
   Sabot de 6 jeux mélangé au générateur cryptographique,
   remélangé quand il reste un quart des cartes.
   Le croupier tire à 16 et reste à 17, y compris sur un 17 souple.
   Le blackjack paie 3 contre 2.
   ============================================================ */
const BJ = {
  sabot: [], coupe: 0,
  mise: 5, jeton: 5,
  mains: [], iMain: 0,        // plusieurs mains possibles après une séparation
  croupier: [], phase: 'mise',// mise · joueur · croupier · fini
  gainTour: 0
};

/* pointsBJ et estBJ vivent dans regles.js */

function piocher(){
  if(BJ.sabot.length <= BJ.coupe){ BJ.sabot = nouveauSabot(6); BJ.coupe = Math.floor(6*52*0.25);
    messageBJ('Nouveau sabot mélangé.'); }
  return BJ.sabot.pop();
}

/* ---------- déroulé d'une main ---------- */
function distribuer(){
  if(BJ.phase!=='mise') return;
  if(BJ.mise < 1){ messageBJ('Pose au moins un jeton.'); return; }
  if(BJ.mise > G.prof.cashBj){ messageBJ('Caisse insuffisante.'); return; }
  G.prof.cashBj -= BJ.mise;
  BJ.mains = [{cartes:[piocher(), piocher()], mise:BJ.mise, finie:false, doublee:false}];
  BJ.croupier = [piocher(), piocher()];
  BJ.iMain = 0; BJ.phase='joueur'; BJ.gainTour = 0;
  Audio_.play('swipe');
  if(estBJ(BJ.mains[0].cartes)){ BJ.mains[0].finie = true; finirCroupier(); }
  else peindreBJ();
}

function tirer(){
  if(BJ.phase!=='joueur') return;
  const m = BJ.mains[BJ.iMain];
  m.cartes.push(piocher());
  Audio_.play('click');
  if(pointsBJ(m.cartes).total >= 21) mainSuivante(); else peindreBJ();
}
function rester(){ if(BJ.phase==='joueur') mainSuivante(); }
function doubler(){
  if(BJ.phase!=='joueur') return;
  const m = BJ.mains[BJ.iMain];
  if(m.cartes.length!==2 || m.doublee) return;
  if(m.mise > G.prof.cashBj){ messageBJ('Pas assez pour doubler.'); return; }
  G.prof.cashBj -= m.mise; m.mise *= 2; m.doublee = true;
  m.cartes.push(piocher()); Audio_.play('coin');
  mainSuivante();
}
function separer(){
  if(BJ.phase!=='joueur' || BJ.mains.length>=4) return;
  const m = BJ.mains[BJ.iMain];
  if(m.cartes.length!==2) return;
  const [a,b] = m.cartes;
  if(valeurSeparation(a)!==valeurSeparation(b)) return;
  if(m.mise > G.prof.cashBj){ messageBJ('Pas assez pour séparer.'); return; }
  G.prof.cashBj -= m.mise;
  BJ.mains.splice(BJ.iMain+1, 0, {cartes:[b, piocher()], mise:m.mise, finie:false, doublee:false});
  m.cartes = [a, piocher()];
  Audio_.play('coin'); peindreBJ();
}
const valeurSeparation = c => ['J','Q','K','10'].includes(c.v) ? '10' : c.v;

function mainSuivante(){
  BJ.mains[BJ.iMain].finie = true;
  const suivante = BJ.mains.findIndex(m=>!m.finie);
  if(suivante >= 0){ BJ.iMain = suivante; peindreBJ(); }
  else finirCroupier();
}

function finirCroupier(){
  BJ.phase = 'croupier';
  peindreBJ();
  const joue = BJ.mains.some(m=>pointsBJ(m.cartes).total<=21);
  const etape = ()=>{
    const p = pointsBJ(BJ.croupier);
    if(joue && p.total < 17){ BJ.croupier.push(piocher()); Audio_.play('click');
      peindreBJ(); setTimeout(etape, 620); }
    else denouement();
  };
  setTimeout(etape, 700);
}

function denouement(){
  BJ.phase = 'fini';
  const pc = pointsBJ(BJ.croupier).total;
  const bjCroupier = estBJ(BJ.croupier);
  let gain = 0; const lignes = [];
  BJ.mains.forEach((m,i)=>{
    const pj = pointsBJ(m.cartes).total;
    const bjJoueur = estBJ(m.cartes) && BJ.mains.length===1;
    let r, g=0;
    if(pj > 21){ r='PERDU'; }
    else if(bjJoueur && !bjCroupier){ g = m.mise + Math.round(m.mise*1.5); r='BLACKJACK'; }
    else if(bjCroupier && !bjJoueur){ r='PERDU'; }
    else if(pc > 21 || pj > pc){ g = m.mise*2; r='GAGNÉ'; }
    else if(pj === pc){ g = m.mise; r='ÉGALITÉ'; }
    else { r='PERDU'; }
    gain += g;
    lignes.push((BJ.mains.length>1?('Main '+(i+1)+' : '):'') + r + (g>m.mise?` +${g-m.mise} €`:g===m.mise?' remboursé':` −${m.mise} €`));
  });
  const mise = BJ.mains.reduce((a,m)=>a+m.mise,0);
  G.prof.cashBj += gain;
  G.prof.mainsBj = (G.prof.mainsBj||0)+1;
  BJ.gainTour = gain - mise;

  let ruine = false;
  if(G.prof.cashBj < 5){ ruine = true; G.prof.ruinesBj = (G.prof.ruinesBj||0)+1;
    G.prof.cashBj = BJ_DEPART; }
  majSerie(); saveLocal(); Cloud.saveJeu('blackjack');

  Audio_.play(BJ.gainTour>0 ? 'win' : BJ.gainTour<0 ? 'fail' : 'ok');
  peindreBJ(lignes.join(' · '), ruine);
}

/* ---------- affichage ---------- */
function messageBJ(t){
  const e=$('#bj-msg'); e.textContent=t; e.classList.add('on');
  clearTimeout(window._bm); window._bm=setTimeout(()=>e.classList.remove('on'),2600);
}

function peindreBJ(resume, ruine){
  const cacheTrou = BJ.phase==='joueur';
  const pc = pointsBJ(cacheTrou ? [BJ.croupier[0]] : BJ.croupier).total;
  $('#bj-croupier').innerHTML = BJ.croupier.map((c,i)=>carteHTML(c, cacheTrou && i===1)).join('');
  $('#bj-pc').textContent = BJ.croupier.length ? (cacheTrou ? pc+' +' : pc) : '';

  $('#bj-mains').innerHTML = BJ.mains.map((m,i)=>{
    const p = pointsBJ(m.cartes);
    const actif = BJ.phase==='joueur' && i===BJ.iMain;
    return `<div class="bjmain${actif?' actif':''}${p.total>21?' saute':''}">
      <div class="cartes">${m.cartes.map(c=>carteHTML(c)).join('')}</div>
      <div class="bjpts">${p.total}${p.souple&&p.total<21?' souple':''} · ${m.mise} €</div>
    </div>`;
  }).join('');

  const m = BJ.mains[BJ.iMain];
  const enCours = BJ.phase==='joueur' && m;
  $('#bj-actions').style.display = enCours ? '' : 'none';
  $('#bj-tapis').style.display   = BJ.phase==='mise' ? '' : 'none';
  if(enCours){
    $('#b-doubler').disabled = m.cartes.length!==2 || m.mise>G.prof.cashBj;
    $('#b-separer').disabled = !(m.cartes.length===2
      && valeurSeparation(m.cartes[0])===valeurSeparation(m.cartes[1])
      && BJ.mains.length<4 && m.mise<=G.prof.cashBj);
  }
  $('#b-rejouer').style.display = BJ.phase==='fini' ? '' : 'none';
  $('#bj-resume').innerHTML = resume
    ? `<b class="${BJ.gainTour>0?'pos':BJ.gainTour<0?'neg':''}">${
        BJ.gainTour>0?'+'+BJ.gainTour+' €':BJ.gainTour<0?BJ.gainTour+' €':'remboursé'}</b>
       <span>${resume}</span>` : '';
  $('#ruine-bj').classList.toggle('on', !!ruine);
  majCaisseBJ();
}

function majCaisseBJ(){
  $('#bj-solde').textContent = fmt(G.prof.cashBj)+' €';
  $('#bj-mise').textContent  = BJ.mise+' €';
  $('#bj-mains-nb').textContent = fmt(G.prof.mainsBj||0);
  const s = G.prof.streak||0;
  $('#bj-serie').textContent = s ? s+' j' : '—';
  $('#bj-sabot').textContent = Math.max(0, BJ.sabot.length - BJ.coupe);
}

/* ---------- amorçage ---------- */
(function bootBJ(){
  if(!requireAuth()) return;
  wireModeSwitch();
  BJ.sabot = nouveauSabot(6); BJ.coupe = Math.floor(6*52*0.25);

  $$('.jetons b').forEach(b=>{
    b.onclick = ()=>{ BJ.jeton = +b.dataset.v; Audio_.play('click');
      $$('.jetons b').forEach(x=>x.classList.toggle('on', x===b)); };
  });
  $('#b-ajouter').onclick = ()=>{ if(BJ.phase!=='mise') return;
    if(BJ.mise + BJ.jeton > G.prof.cashBj){ messageBJ('Caisse insuffisante.'); return; }
    BJ.mise += BJ.jeton; Audio_.play('coin'); majCaisseBJ(); };
  $('#b-remise').onclick = ()=>{ if(BJ.phase!=='mise') return;
    BJ.mise = 5; Audio_.play('click'); majCaisseBJ(); };
  $('#b-distribuer').onclick = ()=>{ Audio_.wake(); distribuer(); };
  $('#b-tirer').onclick   = tirer;
  $('#b-rester').onclick  = rester;
  $('#b-doubler').onclick = doubler;
  $('#b-separer').onclick = separer;
  $('#b-rejouer').onclick = ()=>{ BJ.phase='mise'; BJ.mains=[]; BJ.croupier=[];
    Audio_.play('click'); peindreBJ(); };
  $('#b-sound').onclick = ()=>{ const on=Audio_.toggle();
    $('#b-sound').textContent = on?'SON':'MUET'; $('#b-sound').classList.toggle('off',!on); };
  if(!Audio_.isOn()){ $('#b-sound').textContent='MUET'; $('#b-sound').classList.add('off'); }

  peindreBJ();
  (async()=>{ if(G.token){ try{ await Cloud.restore(); }catch(e){} majCaisseBJ(); } })();
})();
