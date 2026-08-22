/* ============================================================
   BOOT de l'accueil (index.html)
   ============================================================ */
(async function bootHome(){
  const box = $('#authbox');
  const jouer = ()=>{ Audio_.play('click'); go('app.html'); };

  // profil déjà connu → on propose de reprendre
  function connecte(){
    box.innerHTML = `
      <div style="margin-bottom:16px">${missionBar()}</div>
      <button class="btn" id="b-go">Continuer — ${G.prof.pseudo} · niveau ${G.prof.level}</button>
      <a class="btn ghost" href="profil.html">Classement &amp; progression</a>
      <button class="btn ghost" id="b-out">Se déconnecter</button>`;
    $('#b-go').onclick = jouer;
    $('#b-out').onclick = ()=>{ localStorage.removeItem('cyc_tok'); localStorage.removeItem('cyc_ref');
      localStorage.setItem('cyc_guest','0'); location.reload(); };
  }
  function deconnecte(){
    box.innerHTML = `
      <a class="btn" href="signup.html">Créer un compte</a>
      <a class="btn ghost" href="login.html">J’ai déjà un compte</a>
      <button class="btn ghost" id="b-guest">Jouer sans compte</button>`;
    $('#b-guest').onclick = ()=>{ G.guest=true; saveLocal(); jouer(); };
  }
  function horsLigne(){
    box.innerHTML = `
      <button class="btn" id="b-guest2">Jouer</button>
      <p class="note" style="margin-top:12px">Serveur injoignable : la progression est enregistrée
      dans ce navigateur. Compte, classement entre joueurs et historique multi-appareils
      reviennent dès que la connexion est rétablie.</p>`;
    $('#b-guest2').onclick = ()=>{ G.guest=true; saveLocal(); jouer(); };
  }

  // affichage immédiat depuis l'état local : pas d'écran d'attente
  const dejaConnu = (G.token && !G.guest) || (G.guest && G.prof.sessions>0);
  dejaConnu ? connecte() : deconnecte();

  // vérification serveur en arrière-plan, sans bloquer l'affichage
  const up = await Cloud.ping();
  if(!up){ horsLigne(); return; }
  if(G.token && !G.guest){
    const ok = await Cloud.restore();
    ok ? connecte() : deconnecte();
  }
})();
