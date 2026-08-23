/* ============================================================
   BOOT de la page de jeu (app.html)
   ============================================================ */
(async function bootApp(){
  if(!requireAuth()) return;
  wireModeSwitch();
  $('#t-marche').textContent = NOM_MARCHE(G.marche);

  $('#b-zin').onclick   = ()=>zoom(1);
  $('#b-zout').onclick  = ()=>zoom(-1);
  $('#b-scale').onclick = ()=>{ G.view.scale = G.view.scale==='log'?'lin':'log';
    Audio_.play('click'); updateGate(); Chart.draw(); };
  $('#b-sound').onclick = ()=>{ const on=Audio_.toggle();
    $('#b-sound').textContent = on?'SON':'MUET'; $('#b-sound').classList.toggle('off',!on); };
  if(!Audio_.isOn()){ $('#b-sound').textContent='MUET'; $('#b-sound').classList.add('off'); }
  $('#b-menu').onclick  = ()=>{ Audio_.play('click'); go('profil.html'); };
  // le badge « ? » explique pourquoi l'actif est masqué
  $('#chipanon').onclick = ()=>{ Audio_.play('click');
    const b=$('#anonbulle'); b.classList.toggle('on');
    clearTimeout(window._ab); window._ab=setTimeout(()=>b.classList.remove('on'),6000); };

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

  if(G.token){ try{ await Cloud.restore(); }catch(e){} applyMode(); }

  // --- écran de réglages : part engagée et nombre de manches
  const sp=$('#su-part'), sm=$('#su-manches');
  sp.value = Math.round((G.reglages.part||1)*100);
  sm.value = G.reglages.manches||10;
  function peindreSetup(){
    const part = +sp.value/100, dispo = G.prof.cash||CAPITAL_DEPART;
    $('#su-partv').textContent = sp.value+' %';
    $('#su-manchesv').textContent = sm.value;
    $('#su-cash').textContent = dollars(dispo);
    $('#su-marche').textContent = NOM_MARCHE(G.marche);
    $('#su-parte').textContent = dollars(Math.round(dispo*part))+' en jeu, '
      + dollars(Math.round(dispo*(1-part)))+' mis de côté';
  }
  window.peindreSetup = peindreSetup;
  sp.oninput = peindreSetup; sm.oninput = peindreSetup;
  peindreSetup();
  $('#su-go').onclick = ()=>{
    Audio_.play('click');
    G.reglages = {part:+sp.value/100, manches:+sm.value};
    saveLocal(); startSession();
  };
})();
