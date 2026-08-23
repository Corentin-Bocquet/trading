/* ============================================================
   LA ROUE
   Le rendu du cylindre et de la bille, partagé par la roulette
   solo et la roulette en ligne. Le numéro est toujours tiré AVANT
   l'animation : la bille se contente de rejoindre la case déjà
   décidée. Aucun truquage, aucun réglage caché.
   ============================================================ */

/* ---------- rendu de la roue ---------- */
const Roue = (() => {
  let cv = null, cx = null;
  let W=0, H=0, R=0, dpr=1;
  let angRoue = 0, angBille = 0, rayBille = 0, visible = false;

  function resize(){
    cv = document.getElementById('roue');
    if(!cv) return false;
    cx = cv.getContext('2d');
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio||1, 2.5);
    W = r.width; H = r.height; R = Math.min(W,H)/2;
    cv.width = W*dpr; cv.height = H*dpr;
    cx.setTransform(dpr,0,0,dpr,0,0);
    return true;
  }

  function draw(){
    if(!cx) return;
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

/* ---------- animation vers un numéro déjà tiré ----------
   Le même « depart » chez tout le monde donne exactement la même
   trajectoire : à une table en ligne, chacun voit la même bille. */
function animerRoue(n, depart, fini){
  if(!Roue.R) Roue.resize();
  const idx = RL_ORDRE.indexOf(n), pas = Math.PI*2/37;
  const cible = idx*pas;
  const T = 6200, t0 = performance.now(), aR0 = Roue.angRoue;
  const alea = (depart*1000) % 1;                 // même tirage pour tous
  const toursRoue = 5 + alea*1.5;
  const toursBille = 9 + Math.floor(alea*3);
  const d = ((cible - depart) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
  const delta = d - (toursBille+1)*Math.PI*2;
  const rRoule = Roue.R*0.925, rCase = Roue.R*0.735;
  const easeOut = u => 1-Math.pow(1-u,3.2);
  (function frame(t){
    const u = Math.min(1,(t-t0)/T);
    const aR = aR0 + toursRoue*Math.PI*2*easeOut(u);
    const aB = depart + delta*easeOut(u);
    let r = rRoule;
    if(u > 0.55){
      const v = (u-0.55)/0.45, chute = 1-Math.pow(1-v,2);
      const rebond = Math.sin(v*Math.PI*5.5)*Math.pow(1-v,2.4)*Roue.R*0.055;
      r = rRoule + (rCase-rRoule)*chute + Math.abs(rebond);
    }
    Roue.set(aR, aB, r, true); Roue.draw();
    if(u < 1) requestAnimationFrame(frame); else if(fini) fini();
  })(performance.now());
}
