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
  // la partie est sauvegardée à chaque manche : on peut sortir et revenir
  $('#b-menu').onclick  = ()=>{ Audio_.play('click'); go('index.html'); };
  $('#b-bilan').onclick = ()=>{ Audio_.play('click'); show('s-result'); };
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

  /* --- choix du marché, directement sur l'écran de réglages --- */
  function rendreMarches(){
    const m = G.marche || {cat:'tout'};
    const btn = (k,nom,on) => `<button class="mbtn${on?' on':''}" data-k="${esc(k)}">${esc(nom)}</button>`;
    let html = `<div class="mgrid trois">${MARCHES.map(x=>btn(x.k,x.nom,m.cat===x.k)).join('')}</div>`;
    if(m.cat==='secteur'){
      html += `<div class="mgrid sub">${SECTEURS.map(s=>btn('sec:'+s.k,s.nom,m.sous===s.k)).join('')}</div>`;
    }
    if(m.cat==='entreprise'){
      const noms = Object.keys(CATALOGUE.assets)
        .filter(k=>CATALOGUE.assets[k].cat.includes('entreprise'))
        .sort((a,b)=>nomActif(a).localeCompare(nomActif(b)));
      html += `<input class="inp" id="q-ent" placeholder="Chercher une entreprise" style="margin-top:4px">
        <div class="mgrid sub" id="entlist">
          ${btn('ent:', 'AU HASARD', !m.asset)}
          ${noms.map(k=>btn('ent:'+k, nomActif(k).toUpperCase(), m.asset===k)).join('')}
        </div>`;
    }
    const n = scenariosDuMarche(m).length;
    const info = m.cat==='entreprise' && m.asset
      ? `Tu joueras ${esc(nomActif(m.asset))}. La période, elle, reste cachée jusqu'à la fin du cycle.`
      : esc((MARCHES.find(x=>x.k===m.cat)||MARCHES[0]).phrase);
    html += `<p class="note mphrase">${info} <b>${n} cycle${n>1?'s':''} possibles.</b></p>`;
    $('#marchebox').innerHTML = html;

    $$('#marchebox .mbtn').forEach(b=>{
      b.onclick = ()=>{
        Audio_.play('click');
        const k = b.dataset.k;
        if(k.startsWith('sec:'))      G.marche = {cat:'secteur', sous:k.slice(4)};
        else if(k.startsWith('ent:')) G.marche = {cat:'entreprise', asset:k.slice(4)||null};
        else if(k==='secteur')        G.marche = {cat:'secteur', sous:'tech'};
        else if(k==='entreprise')     G.marche = {cat:'entreprise', asset:null};
        else                          G.marche = {cat:k};
        saveLocal(); rendreMarches(); peindreSetup();
      };
    });
    const q = $('#q-ent');
    if(q) q.oninput = ()=>{
      const t = q.value.trim().toLowerCase();
      $$('#entlist .mbtn').forEach(b=>{
        b.style.display = (!t || b.textContent.toLowerCase().includes(t)) ? '' : 'none';
      });
    };
  }

  /* --- une partie interrompue ? on propose de la reprendre --- */
  function peindreReprise(){
    const p = partieEnCours(), box = $('#reprise');
    if(!p){ box.innerHTML=''; return; }
    box.innerHTML = `<div class="reprise">
      <div><u>PARTIE EN COURS</u><b>Manche ${Math.min(p.round+1,p.decs.length)} sur ${p.decs.length}</b>
        <span class="note">${p.defi ? 'DÉFI DU JOUR' : esc(NOM_MARCHE(p.marche))} · commencée le ${new Date(p.t).toLocaleDateString('fr-FR')}</span></div>
      <button class="btn play" id="b-reprendre">REPRENDRE</button>
      <button class="lbmore" id="b-abandon">ABANDONNER ET EN COMMENCER UNE AUTRE</button></div>`;
    $('#b-reprendre').onclick = ()=>{ Audio_.play('click'); reprendrePartie(p); };
    $('#b-abandon').onclick = ()=>{ Audio_.play('click'); oublierPartie(); peindreReprise(); };
  }

  // --- écran de réglages : part engagée et nombre de manches
  /* --- arrivée depuis la page du défi : on lance directement le cycle du jour --- */
  const Q = new URLSearchParams(location.search);
  const viaDefi = !!Q.get('defi'), viaReprise = !!Q.get('reprendre');
  if(viaDefi || viaReprise) history.replaceState(null,'',location.pathname);

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
  window.peindreSetup = ()=>{ peindreSetup(); peindreReprise(); };
  sp.oninput = peindreSetup; sm.oninput = peindreSetup;
  rendreMarches(); peindreSetup(); peindreReprise();
  $('#su-go').onclick = ()=>{
    Audio_.play('click');
    G.reglages = {part:+sp.value/100, manches:+sm.value};
    saveLocal(); oublierPartie(); startSession();
  };

  if(viaReprise){ const p = partieEnCours(); if(p) return reprendrePartie(p); }
  if(viaDefi){
    const p = partieEnCours();
    if(p && p.defi===jourLocal()) return reprendrePartie(p);
    if(defiJoue()) return go('defi.html');
    const d = defiDuJour();
    if(d){ oublierPartie(); startSession(d.id, jourLocal()); }
  }
})();
