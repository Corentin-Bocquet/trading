/* ============================================================
   LOGIQUE DE JEU
   Une partie = un vrai cycle de marché découpé en manches.
   Le portefeuille est le même d'une partie à l'autre.
   ============================================================ */
function priceAt(i){ return G.ser.ohlc[i][3]; }

/* scénarios disponibles dans le marché choisi */
function scenariosDuMarche(m){
  const A = CATALOGUE.assets;
  const dans = k => {
    const c = A[k] ? A[k].cat : [];
    if(m.cat==='tout') return true;
    if(m.cat==='secteur') return c.includes(m.sous);
    if(m.cat==='entreprise') return m.asset ? k===m.asset : c.includes('entreprise');
    return c.includes(m.cat);
  };
  const list = CATALOGUE.scenarios.filter(s=>dans(s.a));
  return list.length ? list : CATALOGUE.scenarios;
}

/* difficulté d'un actif : sert à pondérer les récompenses */
function difficulte(key){
  const v = (CATALOGUE.assets[key]||{}).vol || 30;
  return Math.round(clamp(v/32, .8, 1.8)*100)/100;
}

async function startSession(forcedId){
  const pool = scenariosDuMarche(G.marche);
  let sc;
  if(forcedId) sc = CATALOGUE.scenarios.find(s=>s.id===forcedId);
  if(!sc){
    const last = localStorage.getItem('cyc_last');
    const dispo = pool.filter(s=>s.id!==last);
    sc = (dispo.length?dispo:pool)[Math.floor(Math.random()*(dispo.length?dispo.length:pool.length))];
  }
  localStorage.setItem('cyc_last', sc.id);

  show('s-game');
  $('#t-round').textContent = 'CHARGEMENT…';
  try{ G.ser = await chargerSerie(sc.a); }
  catch(e){ $('#t-round').textContent = 'DONNÉES INDISPONIBLES'; return; }

  G.sc = sc;
  G.base = G.ser.ohlc[sc.start][3];
  G.capital = Math.max(SEUIL_RUINE, G.prof.cash || CAPITAL_DEPART);
  G.round = 0; G.cash = G.capital; G.units = 0; G.cost = 0;
  G.totSpent = 0; G.totUnits = 0;
  G.actions = []; G.done = false; G.revealPrices = false; G.showMA = false;
  applyMode();
  setupRound();
}

function setupRound(){
  const sc = G.sc;
  G.decIdx = sc.decs[G.round];
  G.endVisible = G.decIdx;
  const avail = G.decIdx - sc.start + 1;
  G.reqSpan = Math.min(avail, Math.max(140, Math.floor(avail*0.7)));
  G.view.span = Math.min(avail, 62);
  G.view.scale = (G.ser.ohlc[G.decIdx][3] / G.ser.ohlc[sc.start][3] > 4) ? 'log' : 'lin';
  G.gateOK = !G.gateOn;
  G.maxSpanSeen = G.view.span;
  $('#t-round').textContent = 'MANCHE '+(G.round+1)+' / '+sc.decs.length;
  updateGate(); updateHUD(); Chart.resize(); Chart.draw(); resetCard();
  Audio_.play('whoosh');
}

function updateHUD(){
  const p = priceAt(G.decIdx);
  const valeur = G.cash + G.units*p;
  $('#t-cash').textContent = fmt(G.cash);
  $('#t-inv').textContent  = fmt(G.units*p);
  $('#t-pal').textContent  = G.actions.filter(a=>a.type==='buy').length;
  $('#t-pru').textContent  = G.units>0 ? fmt2(G.cost/G.units/G.base*100) : '—';
  $('#t-lvl').textContent  = G.prof.level;
  $('#t-xp').textContent   = fmt(G.prof.xp)+' XP';
  $('#t-xpbar').style.width = (missionDone()/MISSIONS_PAR_NIVEAU*100)+'%';
  $('#hint-up').style.opacity = G.units>0 ? 1 : .25;

  // bandeau du mode simple : argent restant, argent placé, paliers posés
  const nb = G.actions.filter(a=>a.type==='buy').length;
  $('#m-cash').textContent  = dollars(G.cash);
  $('#m-place').textContent = dollars(G.units*p);
  $('#m-bar').style.width   = clamp(G.cash/valeur*100, 0, 100)+'%';
  $('#m-pal').textContent   = nb;
  $('#t-dots').innerHTML = G.sc.decs.map((_,i)=>
    `<i class="${i<G.round?'done':(i===G.round?'now':'')}"></i>`).join('');
}

/* retour plein écran après une décision : un mot, pas un pictogramme */
const MOT_VERDICT = {exc:'PARFAIT', cor:'BIEN', tie:'MOYEN', bad:'RATÉ'};
function flash(k){
  const f = $('#flash'); if(!f) return;
  f.firstElementChild.textContent = MOT_VERDICT[k] || 'BIEN';
  f.className = 'on v-'+k;
  clearTimeout(G._ft); G._ft = setTimeout(()=>f.className='', 900);
}

/* ---------- zoom et prise de recul ---------- */
function zoom(dir){
  const avail = G.decIdx - G.sc.start + 1;
  G.view.span = Math.round(clamp(G.view.span * (dir>0 ? 1/1.55 : 1.55), 26, avail));
  G.maxSpanSeen = Math.max(G.maxSpanSeen, G.view.span);
  Audio_.play('zoom'); updateGate(); Chart.draw();
}
function updateGate(){
  const sp = G.view.span, an = sp/52;
  $('#t-span').textContent = an>=1.6 ? an.toFixed(1).replace('.',',')+' ANS'
              : an>=0.95 ? '1 AN' : Math.round(sp/4.33)+' MOIS';
  $('#b-scale').textContent = G.view.scale==='log' ? 'LOG' : 'LIN';
  if(!G.gateOn || G.maxSpanSeen >= G.reqSpan) G.gateOK = true;

  const g = $('#gate');
  g.classList.toggle('top', G.mode!=='simple');
  g.classList.toggle('bottom', G.mode==='simple');

  if(!G.gateOn){
    g.classList.add('hide');
    $('#b-zout').classList.remove('pulse');
  }else if(G.gateOK){
    g.classList.add('ok');
    $('#b-zout').classList.remove('pulse');
    $('#gatetxt').textContent = 'Recul pris, tu peux décider';
    clearTimeout(G._gt); G._gt = setTimeout(()=>g.classList.add('hide'), 1600);
  }else{
    g.classList.remove('ok','hide');
    $('#b-zout').classList.add('pulse');
    const reste = Math.max(0.1, Math.round((G.reqSpan-G.maxSpanSeen)/52*10)/10);
    $('#gatetxt').innerHTML = G.mode==='simple'
      ? 'Appuie sur <b>−</b> pour dézoomer avant de jouer'
      : 'Dézoome d’abord : encore ~'+String(reste).replace('.',',')
        +' an'+(reste>=2?'s':'')+' de recul avant de pouvoir décider';
  }
  $('#card').classList.toggle('locked', !G.gateOK);
  if(typeof resetCardFace==='function') resetCardFace();
}
function refusDezoom(){
  const c = $('#card'), g = $('#gate');
  c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope');
  g.classList.remove('hide','beat'); void g.offsetWidth; g.classList.add('beat');
  $('#b-zout').classList.add('pulse');
  Audio_.play('click');
  setTimeout(()=>{ c.classList.remove('nope'); g.classList.remove('beat'); }, 500);
}

/* ============================================================
   INTERACTION : le geste est libre jusqu'à 100 %.
   Les paliers restent affichés comme repères, pas comme limites.
   ============================================================ */
(function swipe(){
  const card=$('#card'), tint=$('#tint'), gauge=$('#gauge'), fill=$('#gaugefill'),
        fbig=$('#f-big'), fsub=$('#f-sub');
  let x0=0,y0=0,drag=false,mode=null,val=0;
  const TH=42, COMMIT=104, RANGE=180;

  // nom de la tranche engagée : un mot, compris tout de suite
  function tranche(v){
    if(v<=PALIER_SAGE) return {mot:'PALIER',  cls:'t1'};
    if(v<=PALIER_GROS) return {mot:'GROS',    cls:'t2'};
    if(v<0.99)         return {mot:'TRÈS GROS',cls:'t3'};
    return {mot:'TOUT', cls:'t4'};
  }

  function neutre(){
    fbig.className='big'; fbig.style.color='var(--txt)';
    const al=card.querySelector('.arrow.l'), ar=card.querySelector('.arrow.r');
    if(G.sc && !G.gateOK){
      al.textContent=''; ar.textContent='';
      fbig.innerHTML = '<span class="lockface">DÉZOOME D’ABORD</span>';
      fsub.textContent = 'prends du recul sur le cycle avant de décider';
      return;
    }
    al.innerHTML = '<u class="w-wait">ATTENDRE</u>';
    ar.innerHTML = '<u class="w-buy">ACHETER</u>';
    fbig.innerHTML = '<span class="swipehint">glisse ton doigt</span>';
    fsub.textContent = G.units>0 ? 'vers le haut pour ENCAISSER' : 'gauche ou droite';
  }
  window.resetCardFace = neutre;

  function render(dx,dy){
    const canSell = G.units>0;
    let m=null;
    if(dy < -TH && Math.abs(dy) > Math.abs(dx) && canSell) m='sell';
    else if(dx >  TH) m='buy';
    else if(dx < -TH) m='wait';
    mode=m;
    card.style.transform = m==='sell' ? `translate(0,${clamp(dy,-95,0)}px)`
      : `translate(${clamp(dx,-120,120)}px,0) rotate(${clamp(dx,-120,120)*0.03}deg)`;
    if(!m){ tint.style.opacity=0; gauge.style.opacity=0; neutre(); return; }

    const al=card.querySelector('.arrow.l'), ar=card.querySelector('.arrow.r');
    al.textContent=''; ar.textContent='';

    if(m==='buy'){
      const t = clamp((dx-TH)/RANGE,0,1);
      val = clamp(0.05 + t*0.95, .05, 1);
      const eur = G.cash*val, tr = tranche(val);
      tint.style.background='linear-gradient(90deg,rgba(22,199,132,0),rgba(22,199,132,.30))';
      tint.style.opacity=1; gauge.style.opacity=1;
      fill.style.width=(val*100)+'%';
      fill.className = 'g-buy '+tr.cls;
      fbig.innerHTML='<span class="w-buy act">ACHETER</span>'
        + '<span class="amt">'+Math.round(val*100)+'<small>%</small></span>'
        + '<span class="tranche '+tr.cls+'">'+tr.mot+'</span>';
      fsub.textContent = dollars(eur)+' sur '+dollars(G.cash)+' disponibles';
    }else if(m==='sell'){
      const t = clamp((-dy-TH)/130,0,1);
      val = clamp(0.05 + t*0.95, .05, 1);
      const tr = tranche(val);
      tint.style.background='linear-gradient(0deg,rgba(59,130,246,0),rgba(59,130,246,.30))';
      tint.style.opacity=1; gauge.style.opacity=1;
      fill.style.width=(val*100)+'%';
      fill.className = 'g-sell '+tr.cls;
      fbig.innerHTML='<span class="w-sell act">ENCAISSER</span>'
        + '<span class="amt">'+Math.round(val*100)+'<small>%</small></span>'
        + '<span class="tranche '+tr.cls+'">'+tr.mot+'</span>';
      fsub.textContent = dollars(G.units*priceAt(G.decIdx)*val)+' récupérés';
    }else{
      val=0; tint.style.background='linear-gradient(270deg,rgba(134,141,154,0),rgba(134,141,154,.22))';
      tint.style.opacity=1; gauge.style.opacity=0;
      fbig.innerHTML='<span class="w-wait act">ATTENDRE</span>';
      fsub.textContent='aucune action ce tour';
    }
  }

  function down(e){
    if(G.revealing || G.done || !G.sc) return;
    if(!G.gateOK){ refusDezoom(); return; }
    Audio_.wake(); drag=true; card.style.transition='';
    x0=e.clientX; y0=e.clientY; card.setPointerCapture&&card.setPointerCapture(e.pointerId);
  }
  function move(e){ if(!drag) return; render(e.clientX-x0, e.clientY-y0); }
  function up(e){
    if(!drag) return; drag=false;
    const dx=e.clientX-x0, dy=e.clientY-y0;
    const far = (mode==='sell') ? (-dy>COMMIT) : (Math.abs(dx)>COMMIT);
    if(mode && far){ const m=mode, v=val; reset(); doAction(m,v); }
    else reset();
  }
  function reset(){
    card.style.transition='transform .22s cubic-bezier(.2,.9,.3,1)';
    card.style.transform='translate(0,0) rotate(0deg)';
    tint.style.opacity=0; gauge.style.opacity=0; mode=null; val=0;
    neutre();
    setTimeout(()=>card.style.transition='',230);
  }
  window.resetCard = reset;

  card.addEventListener('pointerdown',down);
  card.addEventListener('pointermove',move);
  card.addEventListener('pointerup',up);
  card.addEventListener('pointercancel',up);

  window.addEventListener('keydown',e=>{
    if(G.revealing||G.done||!G.sc) return;
    if(!G.gateOK && ['ArrowRight','ArrowLeft','ArrowUp'].includes(e.key)){ refusDezoom(); return; }
    if(e.key==='ArrowRight' && G.gateOK) doAction('buy',.15);
    if(e.key==='ArrowLeft'  && G.gateOK) doAction('wait',0);
    if(e.key==='ArrowUp' && G.units>0 && G.gateOK) doAction('sell',.25);
    if(e.key==='+'||e.key==='=') zoom(1);
    if(e.key==='-') zoom(-1);
  });
})();

/* ---------- exécution d'une décision ---------- */
function doAction(type, v){
  const i = G.decIdx, p = priceAt(i);
  let A = {type, i, price:p, pct:v, pctCap:0, date:G.ser.dates[i]};
  if(type==='buy'){
    const eur = G.cash*v;
    G.cash -= eur; G.units += eur/p; G.cost += eur;
    G.totSpent += eur; G.totUnits += eur/p;
    A.eur = eur; A.pctCap = eur/G.capital;
    A.zone = zoneBuy(p); A.g = gradeBuy(A.zone);
    Audio_.play('coin');
  }else if(type==='sell'){
    const q = G.units*v, eur = q*p;
    G.cost -= G.cost*v; G.units -= q; G.cash += eur;
    A.eur = eur; A.pctCap = eur/G.capital;
    A.zone = zoneSell(p); A.g = gradeSell(A.zone);
    Audio_.play('sell');
  }else{
    A.zone = zoneBuy(p); A.g = gradeWait(A.zone);
    Audio_.play('swipe');
  }
  G.actions.push(A);
  setTimeout(()=>Audio_.play(A.g.k==='exc'?'win':A.g.k==='bad'?'fail':'ok'), 160);
  if(G.mode==='simple') flash(A.g.k); else toast(A.g.k, A.g.t);
  updateHUD();
  revealNext();
}

function toast(k, txt){
  const t=$('#toast'); t.className='toast '+k+' on';
  t.textContent = txt;
  clearTimeout(G._tt); G._tt=setTimeout(()=>t.classList.remove('on'),2300);
}

/* ---------- reveal : les bougies suivantes une par une ---------- */
function revealNext(){
  G.revealing = true;
  const sc=G.sc, target = Math.min(sc.end,
    (sc.decs[G.round+1] !== undefined ? sc.decs[G.round+1] : G.decIdx+sc.step));
  clearInterval(G.anim);
  G.anim = setInterval(()=>{
    if(G.endVisible >= target){
      clearInterval(G.anim); G.revealing=false;
      G.round++;
      if(G.round >= sc.decs.length) endSession(); else setupRound();
      return;
    }
    G.endVisible++;
    G.view.span = Math.min(G.view.span+1, G.endVisible-sc.start+1);
    Chart.draw();
  }, 46);
}

/* ============================================================
   BILAN DE PARTIE : le portefeuille suit d'une partie à l'autre
   ============================================================ */
function endSession(){
  G.done = true; G.revealPrices = true; G.showMA = true;
  const sc=G.sc, ser=G.ser, last = priceAt(sc.end);
  const buys = G.actions.filter(a=>a.type==='buy'), sells = G.actions.filter(a=>a.type==='sell');
  const pru = G.totUnits ? G.totSpent/G.totUnits : null;
  const zPru = pru!=null ? zoneBuy(pru) : null;

  let score = 0;
  G.actions.forEach(a=>{
    const w = a.type==='wait' ? 1 : clamp(0.55 + a.pctCap*3, .55, 1.5);
    a.gained = Math.round(a.g.pts*w*10)/10; score += a.gained;
  });
  let bonus=[], maxP = buys.length? Math.max(...buys.map(b=>b.pctCap)) : 0;
  if(buys.length>=4){ score+=3; bonus.push(['+3','Entrée fractionnée sur '+buys.length+' paliers']); }
  else if(buys.length>0 && buys.length<=2){ score-=2; bonus.push(['−2','Trop peu de paliers : risque concentré']); }
  if(maxP>0.66){ score-=4; bonus.push(['−4','Un seul coup à '+Math.round(maxP*100)+' % du portefeuille']); }
  else if(maxP>0.35){ score-=2; bonus.push(['−2','Un coup à '+Math.round(maxP*100)+' % du portefeuille']); }
  if(sells.length>=1 && sells.every(s=>s.zone>=0.5)){ score+=2; bonus.push(['+2','Profits pris dans la moitié haute']); }
  score = Math.round(score*10)/10;

  // --- portefeuille : ce que vaut le compte à la fin du cycle
  const avant  = G.capital;
  let valeur   = G.cash + G.units*last;
  const gainCycle = valeur - avant;
  let ruine = false;
  if(valeur < SEUIL_RUINE){ ruine = true; G.prof.ruines = (G.prof.ruines||0)+1; valeur = CAPITAL_DEPART; }
  G.prof.cash = Math.round(valeur);

  const bh = avant * (last/priceAt(sc.decs[0]));
  const bons = G.actions.filter(a=>a.g.k==='exc'||a.g.k==='cor').length;

  // --- progression, pondérée par la difficulté de l'actif
  const diff = difficulte(sc.a);
  const avantNiv = G.prof.level;
  G.prof.missions += bons;
  G.prof.rounds   += G.actions.length;
  G.prof.sessions += 1;
  const xpGain = Math.max(10, Math.round((25 + Math.max(0,score)*5 + bons*4) * diff));
  G.prof.xp += xpGain;
  G.prof.level = niveauDe(G.prof.missions);
  G.prof.best = Math.max(G.prof.best, Math.round(score*10)/10);
  const monte = G.prof.level > avantNiv;

  const rec = {t:Date.now(), id:sc.id, a:sc.a, score, zPru, bons, xp:xpGain,
               n:G.actions.length, cash:G.prof.cash, gain:Math.round(gainCycle), ruine};
  G.hist.push(rec); saveLocal();
  Cloud.saveSession(rec, {score, zPru, bonus, valeur, bh, buys:buys.length, diff});

  renderResult({sc,ser,last,buys,sells,pru,zPru,score,bonus,valeur,bh,xpGain,bons,
                avant,gainCycle,ruine,diff});
  show('s-result');
  if(monte) setTimeout(()=>levelUpAnim(G.prof.level), 700);
}
