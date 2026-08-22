/* ============================================================
   SECTION RENDU : moteur de bougies japonaises (canvas)
   - chandeliers obligatoires, jamais de simple ligne
   - échelle log ou linéaire, zoom de quelques mois à plusieurs années
   - prix normalisés base 100 tant que l'actif n'est pas révélé
   ============================================================ */
const Chart = (() => {
  const cv = $('#chart'), cx = cv.getContext('2d');
  let W=0, H=0, dpr=1;
  let PADR = 54, PADB = 22; const PADT = 8;

  function resize(){
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio||1, 2.5);
    W = r.width; H = r.height;
    cv.width = W*dpr; cv.height = H*dpr;
    cx.setTransform(dpr,0,0,dpr,0,0);
  }

  // valeur affichée : indice base 100 (anonymisation) ou prix réel après reveal
  function disp(v){ return G.revealPrices ? v : v / G.base * 100; }

  function range(){
    const end = G.endVisible;
    const start = Math.max(G.sc.start, end - G.view.span + 1);
    return {start, end, n:end-start+1};
  }

  function draw(){
    if(!G.sc) return;
    const {start, end, n} = range();
    const O = G.ser.ohlc;
    // en mode simple, ni axe ni étiquette : les bougies occupent tout l'espace
    const nu = G.mode==='simple' && !G.revealPrices;
    PADR = nu ? 8 : 54; PADB = nu ? 8 : 22;
    cx.clearRect(0,0,W,H);

    // bornes de prix visibles
    let lo=Infinity, hi=-Infinity;
    for(let i=start;i<=end;i++){ if(O[i][2]<lo) lo=O[i][2]; if(O[i][1]>hi) hi=O[i][1]; }
    if(G.showMA && G.ser.ma200) for(let i=start;i<=end;i++){ const m=G.ser.ma200[i];
      if(m){ if(m<lo)lo=m; if(m>hi)hi=m; } }
    const logS = G.view.scale==='log';
    const f = v => logS ? Math.log(Math.max(v,1e-9)) : v;
    let a=f(lo), b=f(hi); const pad=(b-a)*0.08 || 1; a-=pad; b+=pad;
    const plotH = H-PADT-PADB, plotW = W-PADR;
    const y = v => PADT + plotH - (f(v)-a)/(b-a)*plotH;
    const cw = plotW/n, bw = Math.max(1.1, Math.min(cw*0.66, 16));
    const x = i => (i-start+0.5)*cw;

    // grille + axe des prix (à droite, comme sur une vraie plateforme)
    cx.font='10px ui-monospace,Menlo,monospace'; cx.textBaseline='middle';
    const STEPS=5;
    for(let k=0;k<=STEPS;k++){
      const vv = a + (b-a)*k/STEPS;
      const yy = Math.round(y(logS?Math.exp(vv):vv))+.5;
      cx.strokeStyle='#181b21'; cx.lineWidth=1;
      cx.beginPath(); cx.moveTo(0,yy); cx.lineTo(plotW,yy); cx.stroke();
      if(G.mode!=='simple'){
        cx.fillStyle='#5b626e'; cx.textAlign='left';
        cx.fillText(fmt2(disp(logS?Math.exp(vv):vv)), plotW+7, yy);
      }
    }

    // axe du temps : durées relatives uniquement (aucune date pendant la décision)
    cx.textAlign='center'; cx.fillStyle='#4a505b'; cx.font='9.5px ui-monospace,Menlo,monospace';
    const marks = G.mode==='simple' ? [] : [0,.25,.5,.75,1];
    marks.forEach(m=>{
      const i = Math.round(start + (n-1)*m);
      const semaines = end - i;
      let lab;
      if(semaines===0) lab = "AUJOURD'HUI";
      else if(semaines < 52) lab = '−'+Math.round(semaines/4.33)+' mois';
      else { const y = Math.round(semaines/52*10)/10;
             lab = '−'+(y>=3?Math.round(y):String(y).replace('.',','))+' an'+(y>=2?'s':''); }
      if(G.revealPrices) lab = G.ser.dates[i].slice(0,7);
      cx.fillText(lab, clamp(x(i),26,plotW-26), H-8);
    });

    // moyenne mobile 200 jours (uniquement après reveal : info, pas indice)
    if(G.showMA && G.ser.ma200){
      cx.strokeStyle='rgba(245,165,36,.75)'; cx.lineWidth=1.4; cx.beginPath(); let started=false;
      for(let i=start;i<=end;i++){ const m=G.ser.ma200[i]; if(!m) continue;
        const px=x(i), py=y(m); started? cx.lineTo(px,py) : (cx.moveTo(px,py), started=true); }
      cx.stroke();
    }

    // bougies
    for(let i=start;i<=end;i++){
      const [o,h,l,c] = O[i];
      const up = c>=o, col = up?'#16c784':'#ea3943';
      const xi = x(i);
      cx.strokeStyle=col; cx.fillStyle=col; cx.lineWidth=Math.max(1,bw*0.16);
      cx.beginPath(); cx.moveTo(xi, y(h)); cx.lineTo(xi, y(l)); cx.stroke();
      const yo=y(o), yc=y(c);
      const top=Math.min(yo,yc), hgt=Math.max(1.2, Math.abs(yc-yo));
      cx.fillRect(xi-bw/2, top, bw, hgt);
    }

    // marqueurs des paliers posés / profits pris
    G.actions.forEach(A=>{
      if(A.type==='wait' || A.i<start || A.i>end) return;
      const xi=x(A.i), yi=y(A.price);
      const buy = A.type==='buy';
      cx.fillStyle = buy?'#ffd34d':'#3b82f6';
      cx.beginPath();
      if(buy){ cx.moveTo(xi,yi+9); cx.lineTo(xi-5,yi+18); cx.lineTo(xi+5,yi+18); }
      else   { cx.moveTo(xi,yi-9); cx.lineTo(xi-5,yi-18); cx.lineTo(xi+5,yi-18); }
      cx.closePath(); cx.fill();
      cx.font='700 8.5px ui-monospace,Menlo,monospace'; cx.textAlign='center';
      cx.fillText(Math.round(A.pctCap*100)+'%', xi, buy? yi+26 : yi-22);
    });

    // ligne du dernier prix (l'étiquette chiffrée disparaît en mode simple)
    const last = O[end][3], ly = Math.round(y(last))+.5;
    cx.setLineDash([3,3]); cx.strokeStyle='rgba(233,236,241,.32)'; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(0,ly); cx.lineTo(plotW,ly); cx.stroke(); cx.setLineDash([]);
    if(!nu){
      cx.fillStyle='#e9ecf1'; cx.fillRect(plotW+2, ly-9, PADR-4, 18);
      cx.fillStyle='#0a0b0d'; cx.font='700 10px ui-monospace,Menlo,monospace'; cx.textAlign='center';
      cx.fillText(fmt2(disp(last)), plotW+2+(PADR-4)/2, ly);
    }
  }

  return {resize, draw, range};
})();
