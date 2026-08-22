/* ============================================================
   SECTION LOGIQUE DE JEU
   Une partie = un vrai cycle de marché découpé en manches.
   À chaque manche : poser un palier, attendre, ou prendre des profits.
   ============================================================ */
function priceAt(i){ return G.ser.ohlc[i][3]; }

function startSession(forcedId){
  const S = MARKET_DATA.scenarios;
  let sc;
  if(forcedId) sc = S.find(s=>s.id===forcedId);
  if(!sc){ // évite de rejouer le dernier scénario deux fois de suite
    const last = localStorage.getItem('cyc_last');
    const pool = S.filter(s=>s.id!==last);
    sc = pool[Math.floor(Math.random()*pool.length)];
  }
  localStorage.setItem('cyc_last', sc.id);
  G.sc = sc; G.ser = MARKET_DATA.series[sc.a];
  G.base = G.ser.ohlc[sc.start][3];
  G.round = 0; G.cash = CAPITAL_INIT; G.units = 0; G.cost = 0;
  G.actions = []; G.done = false; G.revealPrices = false; G.showMA = false;
  show('s-game');
  setupRound();
}

function setupRound(){
  const sc = G.sc;
  G.decIdx = sc.decs[G.round];
  G.endVisible = G.decIdx;
  const avail = G.decIdx - sc.start + 1;
  G.reqSpan = Math.min(avail, Math.max(140, Math.floor(avail*0.7)));
  G.view.span = Math.min(avail, 62);          // on démarre volontairement zoomé
  G.view.scale = (G.ser.ohlc[G.decIdx][3] / G.ser.ohlc[sc.start][3] > 4) ? 'log' : 'lin';
  G.gateOK = false; G.maxSpanSeen = G.view.span;
  $('#t-round').textContent = 'MANCHE '+(G.round+1)+' / '+sc.decs.length;
  updateGate(); updateHUD(); Chart.resize(); Chart.draw(); resetCard();
  Audio_.play('whoosh');
}

function updateHUD(){
  const p = priceAt(G.decIdx);
  $('#t-cash').textContent = fmt(G.cash);
  $('#t-inv').textContent  = fmt(G.units*p);
  $('#t-pal').textContent  = G.actions.filter(a=>a.type==='buy').length;
  $('#t-pru').textContent  = G.units>0 ? fmt2(G.cost/G.units/G.base*100) : '—';
  $('#t-lvl').textContent  = G.prof.level;
  $('#t-xp').textContent   = fmt(G.prof.xp)+' XP';
  $('#t-xpbar').style.width = (missionDone()/MISSIONS_PAR_NIVEAU*100)+'%';
  $('#hint-up').style.opacity = G.units>0 ? 1 : .25;
  $('#aup').style.opacity = G.units>0 ? .22 : .05;
}

/* ---------- zoom / dézoom + garde-fou de prise de recul ---------- */
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
  if(G.maxSpanSeen >= G.reqSpan) G.gateOK = true;
  const g = $('#gate');
  if(G.gateOK){
    g.classList.add('ok');
    $('#gatetxt').textContent = 'Recul pris · décision débloquée';
    clearTimeout(G._gt); G._gt = setTimeout(()=>g.classList.add('hide'), 1400);
  }else{
    g.classList.remove('ok','hide');
    const reste = Math.max(0, Math.round((G.reqSpan-G.maxSpanSeen)/52*10)/10);
    $('#gatetxt').textContent = 'Dézoome encore ~'+String(reste).replace('.',',')+' an pour décider';
  }
  $('#card').classList.toggle('locked', !G.gateOK);
}

/* ============================================================
   SECTION INTERACTION : le swipe est la seule façon de décider.
   Aucun bouton "tout miser" n'existe : le geste lui-même est
   plafonné à 35 % du cash disponible.
   ============================================================ */
(function swipe(){
  const card=$('#card'), tint=$('#tint'), gauge=$('#gauge'), fill=$('#gaugefill'),
        fbig=$('#f-big'), fsub=$('#f-sub');
  let x0=0,y0=0,drag=false,mode=null,val=0;
  const TH=42, COMMIT=104, RANGE=150;

  function reset(){
    card.style.transition='transform .22s cubic-bezier(.2,.9,.3,1)';
    card.style.transform='translate(0,0) rotate(0deg)';
    tint.style.opacity=0; gauge.style.opacity=0; mode=null; val=0;
    fbig.textContent='GLISSE POUR DÉCIDER';
    fbig.style.color='var(--txt)'; fbig.className='big';
    fsub.textContent='jamais tout d’un coup · 35 % max par palier';
    setTimeout(()=>card.style.transition='',230);
  }
  window.resetCard = reset;

  function render(dx,dy){
    const canSell = G.units>0;
    let m=null;
    if(dy < -TH && Math.abs(dy) > Math.abs(dx) && canSell) m='sell';
    else if(dx >  TH) m='buy';
    else if(dx < -TH) m='wait';
    mode=m;
    card.style.transform = m==='sell' ? `translate(0,${clamp(dy,-140,0)}px)`
      : `translate(${clamp(dx,-170,170)}px,0) rotate(${clamp(dx,-170,170)*0.028}deg)`;
    if(!m){ tint.style.opacity=0; gauge.style.opacity=0;
      fbig.textContent='GLISSE POUR DÉCIDER'; fbig.style.color='var(--txt)';
      fsub.textContent='jamais tout d’un coup · 35 % max par palier'; return; }

    if(m==='buy'){
      const t = clamp((dx-TH)/RANGE,0,1);
      val = 0.05 + t*(MAX_PALIER-0.05);
      const eur = G.cash*val;
      tint.style.background='linear-gradient(90deg,rgba(22,199,132,0),rgba(22,199,132,.30))';
      tint.style.opacity=1; gauge.style.opacity=1;
      fill.style.width=(val/MAX_PALIER*100)+'%';
      fill.style.background='linear-gradient(90deg,#16c784,#5fe8b6)';
      fbig.innerHTML='<span class="amt">'+Math.round(val*100)+'<small>%</small></span>';
      fbig.style.color='#5fe8b6';
      fsub.textContent='PALIER D’ACHAT · '+fmt(eur)+' € sur '+fmt(G.cash)+' € de cash';
    }else if(m==='sell'){
      const t = clamp((-dy-TH)/110,0,1);
      val = 0.05 + t*(MAX_VENTE-0.05);
      tint.style.background='linear-gradient(0deg,rgba(59,130,246,0),rgba(59,130,246,.30))';
      tint.style.opacity=1; gauge.style.opacity=1;
      fill.style.width=(val/MAX_VENTE*100)+'%';
      fill.style.background='linear-gradient(90deg,#3b82f6,#93c5fd)';
      fbig.innerHTML='<span class="amt">'+Math.round(val*100)+'<small>%</small></span>';
      fbig.style.color='#93c5fd';
      fsub.textContent='PRISE DE PROFITS · '+fmt(G.units*priceAt(G.decIdx)*val)+' € de la position';
    }else{
      val=0; tint.style.background='linear-gradient(270deg,rgba(134,141,154,0),rgba(134,141,154,.22))';
      tint.style.opacity=1; gauge.style.opacity=0;
      fbig.textContent='ATTENDRE'; fbig.style.color='#c3c9d4';
      fsub.textContent='aucune action ce tour · le cash reste du cash';
    }
  }

  function down(e){
    if(!G.gateOK || G.revealing || G.done) return;
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
  card.addEventListener('pointerdown',down);
  card.addEventListener('pointermove',move);
  card.addEventListener('pointerup',up);
  card.addEventListener('pointercancel',up);

  // équivalents clavier (desktop / tests) : jamais de bouton "tout miser"
  window.addEventListener('keydown',e=>{
    if(!G.gateOK||G.revealing||G.done) return;
    if(e.key==='ArrowRight') doAction('buy',.15);
    if(e.key==='ArrowLeft')  doAction('wait',0);
    if(e.key==='ArrowUp' && G.units>0) doAction('sell',.25);
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
    G.totSpent = (G.totSpent||0)+eur; G.totUnits = (G.totUnits||0)+eur/p;
    A.eur = eur; A.pctCap = eur/CAPITAL_INIT;
    A.zone = zoneBuy(p); A.g = gradeBuy(A.zone);
    Audio_.play('coin');
  }else if(type==='sell'){
    const q = G.units*v, eur = q*p;
    G.cost -= G.cost*v; G.units -= q; G.cash += eur;
    A.eur = eur; A.pctCap = eur/CAPITAL_INIT;
    A.zone = zoneSell(p); A.g = gradeSell(A.zone);
    Audio_.play('sell');
  }else{
    A.zone = zoneBuy(p); A.g = gradeWait(A.zone);
    Audio_.play('swipe');
  }
  G.actions.push(A);
  setTimeout(()=>Audio_.play(A.g.k==='exc'?'win':A.g.k==='bad'?'fail':'ok'), 160);
  toast(A.g.k, A.g.t);
  updateHUD();
  revealNext();
}

function toast(k, txt){
  const t=$('#toast'); t.className='toast '+k+' on';
  t.innerHTML = (k==='exc'?'✦':k==='bad'?'✕':k==='cor'?'✓':'•')+' <span>'+txt+'</span>';
  clearTimeout(G._tt); G._tt=setTimeout(()=>t.classList.remove('on'),2300);
}

/* ============================================================
   SECTION REVEAL : les bougies suivantes se dessinent une par une
   ============================================================ */
function revealNext(){
  G.revealing = true;
  const sc=G.sc, target = Math.min(sc.end, (sc.decs[G.round+1] !== undefined ? sc.decs[G.round+1] : G.decIdx+sc.step));
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
   SECTION BILAN DE PARTIE
   ============================================================ */
function endSession(){
  G.done = true; G.revealPrices = true; G.showMA = true;
  const sc=G.sc, ser=G.ser, last = priceAt(sc.end);
  const buys = G.actions.filter(a=>a.type==='buy'), sells = G.actions.filter(a=>a.type==='sell');
  const pru = G.totUnits ? G.totSpent/G.totUnits : null;
  const zPru = pru!=null ? zoneBuy(pru) : null;

  // score : somme des points pondérée par la taille engagée
  let score = 0;
  G.actions.forEach(a=>{
    const w = a.type==='wait' ? 1 : clamp(0.55 + a.pctCap*3, .55, 1.5);
    a.gained = Math.round(a.g.pts*w*10)/10; score += a.gained;
  });
  // bonus de comportement : fractionner, ne pas se concentrer
  let bonus=[], maxP = buys.length? Math.max(...buys.map(b=>b.pctCap)) : 0;
  if(buys.length>=4){ score+=3; bonus.push(['+3','Entrée fractionnée sur '+buys.length+' paliers']); }
  else if(buys.length>0 && buys.length<=2){ score-=2; bonus.push(['−2','Trop peu de paliers : tu as concentré ton risque']); }
  if(maxP>0.30){ score-=3; bonus.push(['−3','Un palier à '+Math.round(maxP*100)+' % du capital : trop gros d’un coup']); }
  if(sells.length>=1 && sells.every(s=>s.zone>=0.5)){ score+=2; bonus.push(['+2','Profits pris uniquement dans la moitié haute']); }
  score = Math.round(score*10)/10;

  const valeur = G.cash + G.units*last;
  const bh = CAPITAL_INIT * (last/priceAt(sc.decs[0]));
  const bons = G.actions.filter(a=>a.g.k==='exc'||a.g.k==='cor').length;

  // progression : missions, XP, niveau
  const avant = G.prof.level;
  G.prof.missions += bons;
  G.prof.rounds  += G.actions.length;
  G.prof.sessions+= 1;
  const xpGain = Math.max(10, Math.round(25 + Math.max(0,score)*5 + bons*4));
  G.prof.xp += xpGain;
  G.prof.level = niveauDe(G.prof.missions);
  G.prof.best = Math.max(G.prof.best, Math.round(score*10)/10);
  const monte = G.prof.level > avant;

  const rec = {t:Date.now(), id:sc.id, a:sc.a, score, zPru, bons, xp:xpGain, n:G.actions.length};
  G.hist.push(rec); saveLocal();
  Cloud.saveSession(rec, {score, zPru, bonus, valeur, bh, buys:buys.length});

  renderResult({sc,ser,last,buys,sells,pru,zPru,score,bonus,valeur,bh,xpGain,bons});
  show('s-result');
  if(monte) setTimeout(()=>levelUpAnim(G.prof.level), 700);
}

