/* ============================================================
   BOOT de l'accueil (index.html)
   La connexion est obligatoire : sans compte, on ne joue pas.
   ============================================================ */
(async function bootHome(){
  const box = $('#authbox');
  wireModeSwitch();

  function connecte(){
    box.innerHTML = `
      <div style="margin-bottom:16px">${missionBar()}</div>
      <button class="btn" id="b-go">Continuer — ${G.prof.pseudo} · niveau ${G.prof.level}</button>
      <a class="btn ghost" href="profil.html">Classement &amp; progression</a>
      <button class="btn ghost" id="b-out">Se déconnecter</button>`;
    $('#b-go').onclick = ()=>{ Audio_.play('click'); go('app.html'); };
    $('#b-out').onclick = ()=>{ localStorage.removeItem('cyc_tok');
      localStorage.removeItem('cyc_ref'); location.reload(); };
  }
  function deconnecte(){
    box.innerHTML = `
      <a class="btn" href="signup.html">Créer un compte</a>
      <a class="btn ghost" href="login.html">J’ai déjà un compte</a>
      <p class="note" style="margin-top:14px">Un compte est nécessaire pour jouer :
      il garde ton niveau, tes scores et ta place au classement.</p>`;
  }
  function horsLigneConnu(){
    box.innerHTML = `
      <button class="btn" id="b-go2">Continuer hors connexion</button>
      <p class="note" style="margin-top:12px">Serveur injoignable. Tu peux jouer,
      la progression sera enregistrée dans ce navigateur et repartira vers le serveur
      au retour du réseau.</p>`;
    $('#b-go2').onclick = ()=>{ Audio_.play('click'); G.offline=true; go('app.html'); };
  }
  function horsLigneInconnu(){
    box.innerHTML = `
      <p class="note" style="padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--panel2)">
      Serveur injoignable pour l’instant, impossible de créer un compte.
      Réessaie dans un moment.</p>
      <button class="btn ghost" id="b-retry" style="margin-top:12px">Réessayer</button>`;
    $('#b-retry').onclick = ()=>location.reload();
  }

  // affichage immédiat depuis l'état local, vérification serveur ensuite
  if(G.token) connecte(); else deconnecte();

  const up = await Cloud.ping();
  if(!up){ G.token ? horsLigneConnu() : horsLigneInconnu(); return; }
  if(G.token){ (await Cloud.restore()) ? connecte() : deconnecte(); }
})();
