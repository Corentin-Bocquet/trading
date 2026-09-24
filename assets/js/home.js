/* ============================================================
   BOOT de l'accueil (index.html)
   Les quatre jeux au centre, le compte en haut, la navigation en bas.
   Le choix du marché de trading vit maintenant sur l'écran de
   réglages du trading, là où il sert.
   ============================================================ */
(async function bootHome(){
  const box = $('#authbox');
  wireModeSwitch();

  // l'aide à l'installation ne sert à rien une fois l'app installée
  const installee = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if(installee && $('#a2hs')) $('#a2hs').style.display = 'none';

  /* ---------- compte ---------- */
  function connecte(){
    const s = G.prof.streak||0;
    const attente = Cloud.enAttente();
    box.innerHTML = `
      <a class="salut" href="profil.html">
        ${avatar(G.prof.pseudo, G.prof.avatar)}
        <div class="pinfo"><b>Salut ${esc(G.prof.pseudo)}</b>
          <span class="note">niveau ${G.prof.level} · ${fmt(G.prof.xp)} XP${s>=1?` · série ${s} jour${s>1?'s':''}`:''}</span></div>
        <span class="lvl-badge">${G.prof.level}</span>
      </a>
      ${G.offline ? `<p class="expl"><b>Hors connexion.</b> Tu peux jouer : la progression est gardée
        sur ce téléphone et partira vers le serveur au retour du réseau.</p>`
        : attente ? '<p class="note" style="text-align:center">Synchronisation en cours…</p>' : ''}`;
  }
  function deconnecte(){
    box.innerHTML = `
      <p class="expl">Un compte garde ton argent, ton niveau et ta place au classement,
      sur tous tes appareils. <b>30 secondes, pas plus.</b></p>
      <a class="btn" href="signup.html">CRÉER UN COMPTE</a>
      <a class="btn ghost" href="login.html">J'AI DÉJÀ UN COMPTE</a>`;
  }
  function horsLigneInconnu(){
    box.innerHTML = `<p class="expl">Serveur injoignable pour l'instant, impossible de créer un compte.
      Réessaie dans un moment.</p>
      <button class="btn ghost" id="b-retry">RÉESSAYER</button>`;
    $('#b-retry').onclick = ()=>location.reload();
  }

  /* ---------- la carte principale : reprendre ou lancer un cycle ---------- */
  function peindreHero(enCours, p){
    const h = G.hist.filter(x=>x.cash!=null).slice(-20);
    const g = gainDe(G.prof);
    $('#hero-cash').textContent = dollars(G.prof.cash);
    const pc = g/(CAPITAL_DEPART*(1+(G.prof.ruines||0)))*100;
    $('#hero-var').textContent = (g>=0?'+':'−')+Math.abs(pc).toFixed(1).replace('.',',')+' %';
    $('#hero-var').className = g>=0 ? 'pos' : 'neg';
    $('#hero-lab').textContent = enCours
      ? (p.defi ? 'DÉFI EN COURS' : 'REPRENDRE') + ' · MANCHE '+Math.min(p.round+1,p.decs.length)+' SUR '+p.decs.length
      : 'TON PORTEFEUILLE DE TRADING';
    $('#hero-cta').textContent = enCours ? 'REPRENDRE LA PARTIE' : 'LIRE UN CYCLE';
    const c = $('#hero-courbe'), r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio||1,2.5);
    c.width = r.width*dpr; c.height = r.height*dpr;
    const x = c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
    const v = [CAPITAL_DEPART, ...h.map(e=>e.cash)];
    if(v.length<2){ x.strokeStyle='#2a2f39'; x.setLineDash([4,4]);
      x.beginPath(); x.moveTo(0,r.height/2); x.lineTo(r.width,r.height/2); x.stroke(); return; }
    const lo=Math.min(...v), hi=Math.max(...v), W=r.width, H=r.height;
    const px=i=>i*W/(v.length-1), py=e=>H-4-(e-lo)/((hi-lo)||1)*(H-8);
    const gr = x.createLinearGradient(0,0,0,H); gr.addColorStop(0,'rgba(245,165,36,.28)'); gr.addColorStop(1,'rgba(245,165,36,0)');
    x.beginPath(); v.forEach((e,i)=> i? x.lineTo(px(i),py(e)) : x.moveTo(0,py(e)));
    x.lineTo(W,H); x.lineTo(0,H); x.closePath(); x.fillStyle=gr; x.fill();
    x.beginPath(); v.forEach((e,i)=> i? x.lineTo(px(i),py(e)) : x.moveTo(0,py(e)));
    x.strokeStyle='#f5a524'; x.lineWidth=2; x.stroke();
  }

  /* ---------- le bandeau : où tu en es dans chaque jeu, en un coup d'œil ---------- */
  function peindreTicker(){
    const der = G.hist.filter(x=>x.cash!=null).slice(-1)[0];
    const sg = n => (n>=0?'+':'−')+fmt(Math.abs(n));
    const cl = n => n>0?'pos':n<0?'neg':'';
    const it = [];
    if(der) it.push(['DERNIER CYCLE', sg(der.gain)+' $', cl(der.gain)]);
    ['roulette','blackjack','poker'].forEach(j=>{ const g=gainJeu(G.prof,j); it.push([JEUX[j].nom, sg(g)+' €', cl(g)]); });
    it.push(['SÉRIE', (G.prof.streak||0)+' J', 'or']);
    $('#ticker').innerHTML = it.map(([k,v,c])=>`<span>${k} <b class="${c}">${v}</b></span>`).join('');
  }

  function majJeux(){
    const t=$('#j-trading'), r=$('#j-roulette'), bj=$('#j-blackjack'), pk=$('#j-poker');
    if(t) t.textContent = dollars(G.prof.cash);
    if(r) r.textContent = fmt(G.prof.cashRl)+' €';
    if(bj) bj.textContent = fmt(G.prof.cashBj)+' €';
    if(pk) pk.textContent = fmt(G.prof.cashPk)+' €';
    let enCours = false, p = null;
    try{ p = JSON.parse(localStorage.getItem('cyc_partie')||'null');
      enCours = !!(p && Array.isArray(p.decs) && (!p.uid || p.uid===localStorage.getItem('cyc_uid'))); }catch(e){}
    const pr = $('#j-reprise'); if(pr) pr.hidden = !enCours;
    peindreHero(enCours, p); peindreTicker();
    const dj = defiJoue();
    $('#b-defi').classList.toggle('fait', dj);
    $('#defi-txt').textContent = dj ? 'Défi du jour joué : vois ton rang' : 'Le cycle du jour : tout le monde joue le même';
    if(p && enCours) $('#hero').setAttribute('href', p.defi ? 'app.html?defi=1' : 'app.html?reprendre=1');
    // sans compte, les jeux mènent à la connexion
    if(!G.token) $$('.jeux .jeu, #hero, #b-defi').forEach(a=>a.setAttribute('href','login.html'));
  }
  majJeux();

  if(G.token) connecte(); else deconnecte();
  const up = await Cloud.ping();
  if(!up){ if(G.token){ G.offline = true; connecte(); } else horsLigneInconnu(); return; }
  if(G.token){ (await Cloud.restore()) ? connecte() : (G.token ? connecte() : deconnecte()); majJeux(); }
})();
