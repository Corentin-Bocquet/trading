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

  function majJeux(){
    const t=$('#j-trading'), r=$('#j-roulette'), bj=$('#j-blackjack'), pk=$('#j-poker');
    if(t) t.textContent = dollars(G.prof.cash);
    if(r) r.textContent = fmt(G.prof.cashRl)+' €';
    if(bj) bj.textContent = fmt(G.prof.cashBj)+' €';
    if(pk) pk.textContent = fmt(G.prof.cashPk)+' €';
    let enCours = false;
    try{ const p = JSON.parse(localStorage.getItem('cyc_partie')||'null');
      enCours = !!(p && (!p.uid || p.uid===localStorage.getItem('cyc_uid'))); }catch(e){}
    const pr = $('#j-reprise'); if(pr) pr.hidden = !enCours;
    // sans compte, les jeux mènent à la connexion
    if(!G.token) $$('.jeux .jeu').forEach(a=>a.setAttribute('href','login.html'));
  }
  majJeux();

  if(G.token) connecte(); else deconnecte();
  const up = await Cloud.ping();
  if(!up){ if(G.token){ G.offline = true; connecte(); } else horsLigneInconnu(); return; }
  if(G.token){ (await Cloud.restore()) ? connecte() : (G.token ? connecte() : deconnecte()); majJeux(); }
})();
