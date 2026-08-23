/* ============================================================
   ROULETTE EUROPÉENNE
   37 cases, un seul zéro. Le numéro est tiré AVANT l'animation,
   par le générateur cryptographique du navigateur : la bille se
   contente de rejoindre la case déjà décidée. Aucun truquage,
   aucun réglage caché.
   ============================================================ */

/* ---------- rendu de la roue ---------- */
const Roue = (() => {
  const cv = document.getElementById('roue'), cx = cv.getContext('2d');
  let W=0, H=0, R=0, dpr=1;
  let angRoue = 0, angBille = 0, rayBille = 0, visible = false;

  function resize(){
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio||1, 2.5);
    W = r.width; H = r.height; R = Math.min(W,H)/2;
    cv.width = W*dpr; cv.height = H*dpr;
    cx.setTransform(dpr,0,0,dpr,0,0);
  }

  function draw(){
    const cxp=W/2, cyp=H/2;
    cx.clearRect(0,0,W,H);

    // cuvette extérieure
    const g = cx.createRadialGradient(cxp,cyp,R*0.55,cxp,cyp,R);
    g.addColorStop(0,'#2a1b10'); g.addColorStop(.7,'#3d2716'); g.addColorStop(1,'#160d07');
    cx.fillStyle=g; cx.beginPath(); cx.arc(cxp,cyp,R,0,7); cx.fill();
    cx.strokeStyle='#5a3a20'; cx.lineWidth=Math.max(2,R*0.02);
    cx.beginPath(); cx.arc(cxp,cyp,R*0.985,0,7); cx.stroke();

    cx.save(); cx.translate(cxp,cyp); cx.rotate(angRoue);

    const rOut=R*0.86, rIn=R*0.615, N=RL_ORDRE.length, pas=Math.PI*2/N;
    for(let i=0;i<N;i++){
      const n=RL_ORDRE[i], a0=i*pas-Math.PI/2-pas/2, a1=a0+pas;
      const c=couleurDe(n);
      cx.beginPath(); cx.moveTo(0,0);
      cx.arc(0,0,rOut,a0,a1); cx.closePath();
      cx.fillStyle = c==='vert' ? '#0d7a3f' : c==='rouge' ? '#b31421' : '#141414';
      cx.fill();
      cx.strokeStyle='rgba(214,178,120,.55)'; cx.lineWidth=Math.max(.8,R*0.006); cx.stroke();
      // numéro
      cx.save();
      cx.rotate(a0+pas/2+Math.PI/2);
      cx.fillStyle='#f2e4c8'; cx.textAlign='center'; cx.textBaseline='middle';
      cx.font=`700 ${Math.max(7,R*0.072)}px ui-monospace,Menlo,monospace`;
      cx.fillText(String(n), 0, -(rOut+rIn)/2);
      cx.restore();
    }
    // anneau intérieur et cône central
    cx.beginPath(); cx.arc(0,0,rIn,0,7);
    const g2=cx.createRadialGradient(0,-rIn*.3,rIn*.1,0,0,rIn);
    g2.addColorStop(0,'#6a4526'); g2.addColorStop(1,'#2c1a0d');
    cx.fillStyle=g2; cx.fill();
    cx.strokeStyle='#d6b278'; cx.lineWidth=Math.max(1.5,R*0.012); cx.stroke();
    // déflecteurs
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4;
      cx.save(); cx.rotate(a); cx.fillStyle='#d6b278';
      cx.beginPath(); cx.ellipse(0,-rIn*0.72,R*0.018,R*0.045,0,0,7); cx.fill();
      cx.restore();
    }
    // moyeu
    cx.beginPath(); cx.arc(0,0,rIn*0.30,0,7); cx.fillStyle='#d6b278'; cx.fill();
    cx.beginPath(); cx.arc(0,0,rIn*0.16,0,7); cx.fillStyle='#8a6435'; cx.fill();
    cx.restore();

    // bille
    if(visible){
      const a = angRoue + angBille - Math.PI/2;
      const bx = cxp + Math.cos(a)*rayBille, by = cyp + Math.sin(a)*rayBille;
      const rb = Math.max(3.5, R*0.045);
      cx.beginPath(); cx.arc(bx,by+rb*0.35,rb*0.9,0,7);
      cx.fillStyle='rgba(0,0,0,.45)'; cx.fill();
      const gb=cx.createRadialGradient(bx-rb*.35,by-rb*.4,rb*.15,bx,by,rb);
      gb.addColorStop(0,'#ffffff'); gb.addColorStop(1,'#b9bcc4');
      cx.beginPath(); cx.arc(bx,by,rb,0,7); cx.fillStyle=gb; cx.fill();
    }
  }

  return {
    resize, draw,
    set(aR,aB,rB,v){ angRoue=aR; angBille=aB; rayBille=rB; visible=v; },
    get R(){ return R; }, get angRoue(){ return angRoue; }
  };
})();

/* ---------- lancement d'un tour ---------- */
function tirageAleatoire(){
  const buf = new Uint32Array(1);
  // rejet pour éviter le biais du modulo
  const limite = Math.floor(4294967296/37)*37;
  do { crypto.getRandomValues(buf); } while(buf[0] >= limite);
  return buf[0] % 37;
}

const RL = {
  mises:{}, jeton:1, tourne:false, dernier:null,
  total(){ return Object.values(this.mises).reduce((a,b)=>a+b,0); }
};

function lancer(){
  if(RL.tourne) return;
  const total = RL.total();
  if(total <= 0){ messageRl('Pose au moins un jeton avant de lancer.'); return; }
  if(total > G.prof.cashRl){ messageRl('Tu n’as pas assez pour cette mise.'); return; }

  RL.tourne = true;
  // on ramène le joueur sur la roue : il vient de miser en bas de page
  const w = document.querySelector('.roulettewrap');
  if(w) w.scrollIntoView({behavior:'smooth', block:'center'});
  G.prof.cashRl -= total;               // la mise quitte la caisse au lancement
  majSoldes();
  $('#b-lancer').disabled = true;
  Audio_.play('whoosh');

  const n = tirageAleatoire();
  const idx = RL_ORDRE.indexOf(n);
  const pas = Math.PI*2/37;
  const cible = idx*pas;                // position de la case dans le repère de la roue

  const T = 6200;
  const t0 = performance.now();
  const aR0 = Roue.angRoue;
  const toursRoue = 5 + Math.random()*1.5;
  const depart = Math.random()*Math.PI*2;
  const toursBille = 9 + Math.floor(Math.random()*3);
  let d = ((cible - depart) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
  const delta = d - (toursBille+1)*Math.PI*2;      // la bille part à l'envers

  const rRoule = Roue.R*0.925, rCase = Roue.R*0.735;
  const easeOut = u => 1-Math.pow(1-u,3.2);

  function frame(t){
    const u = Math.min(1,(t-t0)/T);
    const aR = aR0 + toursRoue*Math.PI*2*easeOut(u);
    const aB = depart + delta*easeOut(u);
    let r = rRoule;
    if(u > 0.55){
      const v = (u-0.55)/0.45;
      const chute = 1-Math.pow(1-v,2);
      // rebonds amortis sur les déflecteurs
      const rebond = Math.sin(v*Math.PI*5.5)*Math.pow(1-v,2.4)*Roue.R*0.055;
      r = rRoule + (rCase-rRoule)*chute + Math.abs(rebond);
    }
    Roue.set(aR, aB, r, true); Roue.draw();
    if(u < 1) requestAnimationFrame(frame);
    else terminer(n, total);
  }
  requestAnimationFrame(frame);
}

function terminer(n, mise){
  let gain = 0, detail = [];
  for(const [cle,montant] of Object.entries(RL.mises)){
    const m = gainMise(cle, n);
    if(m>0){ const g = montant*(m+1); gain += g; detail.push(nomMise(cle)+' +'+g+' €'); }
  }
  G.prof.cashRl += gain;
  G.prof.toursRl = (G.prof.toursRl||0)+1;
  G.prof.spins = (G.prof.spins||[]); G.prof.spins.push(n);
  if(G.prof.spins.length > 10000) G.prof.spins = G.prof.spins.slice(-10000);

  let ruine = false;
  if(G.prof.cashRl < 1){ ruine = true; G.prof.ruinesRl = (G.prof.ruinesRl||0)+1;
    G.prof.cashRl = RL_DEPART; }

  majSerie(); saveLocal(); Cloud.saveRoulette();

  RL.dernier = n; RL.tourne = false;
  $('#b-lancer').disabled = false;
  afficherResultat(n, gain, mise, detail, ruine);
  majSoldes(); dessinerHistorique(); majStats();
  Audio_.play(gain>0 ? 'win' : 'fail');
  if(gain>0) Audio_.play('coin');
  RL.mises = {}; dessinerMises();
}

/* ---------- affichage ---------- */
function afficherResultat(n, gain, mise, detail, ruine){
  const c = couleurDe(n);
  const net = gain - mise;
  $('#res-num').textContent = n;
  $('#res-num').className = 'resnum ' + c;
  $('#res-txt').innerHTML = (c==='vert'?'ZÉRO':c.toUpperCase())
    + ' &middot; ' + (n===0?'':(n%2===0?'PAIR':'IMPAIR'))
    + (n===0?'':' &middot; ' + (n<=18?'1 À 18':'19 À 36'));
  $('#res-gain').innerHTML = net>=0
    ? `<b class="pos">+${net} €</b>` : `<b class="neg">−${-net} €</b>`;
  $('#res-detail').textContent = detail.length ? detail.join(' · ')
    : (mise>0 ? 'Aucune mise gagnante.' : '');
  $('#resultat').classList.add('on');
  $('#ruine-rl').classList.toggle('on', !!ruine);
  clearTimeout(window._rt); window._rt = setTimeout(()=>$('#resultat').classList.remove('on'), 6000);
}

function messageRl(t){
  const e = $('#rl-msg'); e.textContent = t; e.classList.add('on');
  clearTimeout(window._rm); window._rm = setTimeout(()=>e.classList.remove('on'), 2600);
}

function majSoldes(){
  $('#rl-solde').textContent = fmt(G.prof.cashRl)+' €';
  $('#rl-mise').textContent  = RL.total()+' €';
  $('#rl-tours').textContent = fmt(G.prof.toursRl||0);
  const s = G.prof.streak||0;
  $('#rl-serie').textContent = s ? s+' j' : '—';
}

/* les 30 derniers numéros, du plus récent au plus ancien */
function dessinerHistorique(){
  const h = (G.prof.spins||[]).slice(-30).reverse();
  $('#rl-hist').innerHTML = h.length
    ? h.map(n=>`<s class="${couleurDe(n)}">${n}</s>`).join('')
    : '<span class="note">aucun tour joué</span>';
}

/* ---------- statistiques ---------- */
let FENETRE = 100;
function majStats(){
  const all = G.prof.spins||[];
  const d = all.slice(-FENETRE);
  const box = $('#rl-stats');
  if(!d.length){ box.innerHTML = '<p class="note">Joue quelques tours pour voir des statistiques.</p>'; return; }
  const cpt = {rouge:0,noir:0,vert:0,pair:0,impair:0,manque:0,passe:0};
  const parNum = new Array(37).fill(0);
  d.forEach(n=>{
    cpt[couleurDe(n)]++; parNum[n]++;
    if(n!==0){ cpt[n%2===0?'pair':'impair']++; cpt[n<=18?'manque':'passe']++; }
  });
  const pc = v => Math.round(v/d.length*100)+' %';
  const tri = parNum.map((v,i)=>[i,v]).sort((a,b)=>b[1]-a[1]);
  const chauds = tri.slice(0,5).map(x=>`<s class="${couleurDe(x[0])}">${x[0]}</s>`).join('');
  const froids = tri.slice(-5).reverse().map(x=>`<s class="${couleurDe(x[0])}">${x[0]}</s>`).join('');
  box.innerHTML = `
    <div class="statgrid">
      <div><u>ROUGE</u><b>${pc(cpt.rouge)}</b></div>
      <div><u>NOIR</u><b>${pc(cpt.noir)}</b></div>
      <div><u>ZÉRO</u><b>${pc(cpt.vert)}</b></div>
      <div><u>PAIR</u><b>${pc(cpt.pair)}</b></div>
      <div><u>IMPAIR</u><b>${pc(cpt.impair)}</b></div>
      <div><u>TOURS</u><b>${d.length}</b></div>
    </div>
    <div class="hotrow"><u>LES PLUS SORTIS</u><div class="hist">${chauds}</div></div>
    <div class="hotrow"><u>LES MOINS SORTIS</u><div class="hist">${froids}</div></div>`;
}

/* ---------- tapis de mises ---------- */
function dessinerTapis(){
  const N = n => `<button class="cell ${couleurDe(n)}" data-c="n${n}">${n}</button>`;
  let grille = '';
  for(let l=0;l<12;l++){
    for(let col=3;col>=1;col--){ grille += N(l*3+col); }
  }
  const ext = c => `<button class="zone" data-c="${c}">${RL_MISES[c].nom}</button>`;
  $('#tapis').innerHTML = `
    <div class="zerorow"><button class="cell vert large" data-c="n0">0</button></div>
    <div class="grille">${grille}</div>
    <div class="zones pro"><div>${ext('d1')}${ext('d2')}${ext('d3')}</div>
      <div>${ext('c1')}${ext('c2')}${ext('c3')}</div></div>
    <div class="zones"><div>${ext('manque')}${ext('pair')}
      <button class="zone rouge" data-c="rouge">ROUGE</button>
      <button class="zone noir" data-c="noir">NOIR</button>
      ${ext('impair')}${ext('passe')}</div></div>`;
  $$('#tapis [data-c]').forEach(b=>{
    b.onclick = ()=>{
      if(RL.tourne) return;
      const c = b.dataset.c;
      if(RL.total() + RL.jeton > G.prof.cashRl){ messageRl('Solde insuffisant.'); return; }
      RL.mises[c] = (RL.mises[c]||0) + RL.jeton;
      Audio_.play('coin'); dessinerMises(); majSoldes();
    };
  });
}

function dessinerMises(){
  $$('#tapis [data-c]').forEach(b=>{
    const m = RL.mises[b.dataset.c]||0;
    b.classList.toggle('mise', m>0);
    let j = b.querySelector('.jeton');
    if(m>0){ if(!j){ j=document.createElement('i'); j.className='jeton'; b.appendChild(j); } j.textContent=m; }
    else if(j) j.remove();
  });
  $('#b-lancer').classList.toggle('pret', RL.total()>0);
  majSoldes();
}

/* ---------- amorçage ---------- */
(function bootRoulette(){
  if(!requireAuth()) return;
  wireModeSwitch();

  Roue.resize(); Roue.set(0, 0, Roue.R*0.735, false); Roue.draw();
  window.addEventListener('resize', ()=>{ Roue.resize();
    Roue.set(Roue.angRoue, 0, Roue.R*0.735, !!RL.dernier); Roue.draw(); });

  dessinerTapis(); dessinerMises(); dessinerHistorique(); majStats(); majSoldes();

  $$('.jetons b').forEach(b=>{
    b.onclick = ()=>{ RL.jeton = +b.dataset.v; Audio_.play('click');
      $$('.jetons b').forEach(x=>x.classList.toggle('on', x===b)); };
  });
  $('#b-lancer').onclick  = ()=>{ Audio_.wake(); lancer(); };
  $('#b-annuler').onclick = ()=>{ if(RL.tourne) return; Audio_.play('click');
    const k = Object.keys(RL.mises); if(!k.length) return;
    const d = k[k.length-1];
    RL.mises[d] -= RL.jeton; if(RL.mises[d]<=0) delete RL.mises[d];
    dessinerMises(); };
  $('#b-vider').onclick   = ()=>{ if(RL.tourne) return; Audio_.play('click');
    RL.mises = {}; dessinerMises(); };
  $$('.fen b').forEach(b=>{
    b.onclick = ()=>{ FENETRE = +b.dataset.f; Audio_.play('click');
      $$('.fen b').forEach(x=>x.classList.toggle('on', x===b)); majStats(); };
  });
  $('#b-sound').onclick = ()=>{ const on=Audio_.toggle();
    $('#b-sound').textContent = on?'SON':'MUET'; $('#b-sound').classList.toggle('off',!on); };
  if(!Audio_.isOn()){ $('#b-sound').textContent='MUET'; $('#b-sound').classList.add('off'); }

  (async()=>{ if(G.token){ try{ await Cloud.restore(); }catch(e){}
    dessinerHistorique(); majStats(); majSoldes(); } })();
})();
