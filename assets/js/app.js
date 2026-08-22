/* ============================================================
   BOOT de la page de jeu (app.html)
   ============================================================ */
(async function bootApp(){
  // contrôles graphiques
  $('#b-zin').onclick   = ()=>zoom(1);
  $('#b-zout').onclick  = ()=>zoom(-1);
  $('#b-scale').onclick = ()=>{ G.view.scale = G.view.scale==='log'?'lin':'log';
    Audio_.play('click'); updateGate(); Chart.draw(); };
  $('#b-sound').onclick = ()=>{ const on=Audio_.toggle();
    $('#b-sound').textContent = on?'♪':'✕'; $('#b-sound').style.opacity = on?1:.4; };
  if(!Audio_.isOn()){ $('#b-sound').textContent='✕'; $('#b-sound').style.opacity=.4; }
  $('#b-menu').onclick  = ()=>{ Audio_.play('click'); go('profil.html'); };

  // zoom molette + pincement à deux doigts
  const cw = $('#chartwrap');
  cw.addEventListener('wheel', e=>{ e.preventDefault(); if(!G.sc) return;
    const avail = G.decIdx - G.sc.start + 1;
    G.view.span = Math.round(clamp(G.view.span*(e.deltaY>0?1.12:0.89), 26, avail));
    G.maxSpanSeen = Math.max(G.maxSpanSeen, G.view.span); updateGate(); Chart.draw();
  }, {passive:false});
  let pts=new Map(), d0=0, s0=0;
  cw.addEventListener('pointerdown', e=>pts.set(e.pointerId,e));
  cw.addEventListener('pointermove', e=>{
    if(!pts.has(e.pointerId)||!G.sc) return; pts.set(e.pointerId,e);
    if(pts.size===2){
      const [a,b]=[...pts.values()];
      const d=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      if(!d0){ d0=d; s0=G.view.span; return; }
      const avail = G.decIdx - G.sc.start + 1;
      G.view.span = Math.round(clamp(s0*d0/d, 26, avail));
      G.maxSpanSeen = Math.max(G.maxSpanSeen, G.view.span); updateGate(); Chart.draw();
    }
  });
  const clr = e=>{ pts.delete(e.pointerId); if(pts.size<2) d0=0; };
  cw.addEventListener('pointerup',clr); cw.addEventListener('pointercancel',clr);
  window.addEventListener('resize', ()=>{ if(G.sc){ Chart.resize(); Chart.draw(); } });

  // synchronisation du profil serveur avant de lancer la partie
  if(G.token && !G.guest){ try{ await Cloud.restore(); }catch(e){} }
  startSession();
})();
