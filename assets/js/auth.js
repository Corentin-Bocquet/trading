/* ============================================================
   BOOT des pages connexion / inscription
   ============================================================ */
(function bootAuth(){
  const form = $('#authform'); if(!form) return;
  const mode = form.dataset.mode;              // "login" ou "signup"
  const err = m => $('#err').textContent = m||'';
  const okm = m => { const e=$('#okmsg'); if(e) e.textContent = m||''; };

  let occupe = false;
  $('#submit').onclick = async ()=>{
    if(occupe) return;
    Audio_.wake(); Audio_.play('click'); err(''); okm('');
    const mail = $('#i-mail').value.trim();
    const pass = $('#i-pass').value;
    const pseudo = $('#i-pseudo') ? $('#i-pseudo').value.trim() : '';
    if(!mail || !mail.includes('@')) return err('Entre une adresse email valide.');
    if(pass.length<6) return err('Le mot de passe fait 6 caractères minimum.');
    if(mode==='signup'){
      if(!pseudo) return err('Choisis un pseudo : c’est lui qui apparaît au classement.');
      const c = $('#i-pass2').value;
      if(c!==pass) return err('Les deux mots de passe ne sont pas identiques.');
    }
    if(pseudo.length>18) return err('Le pseudo fait 18 caractères maximum.');
    $('#submit').textContent = 'Un instant…'; occupe = true;
    try{
      if(mode==='signup') await Cloud.signup(mail, pass, pseudo);
      else                await Cloud.login(mail, pass);
      G.offline=false; saveLocal();
      okm('Connecté. Choisis ton jeu.');
      setTimeout(()=>go('index.html'), 350);
    }catch(e){
      err(traduire(e.message)); occupe = false;
      $('#submit').textContent = mode==='signup' ? 'Créer mon compte' : 'Se connecter';
    }
  };
  form.addEventListener('keydown', e=>{ if(e.key!=='Enter') return;
    const b = $('#submit') || $('#b-new'); if(b) b.click(); });

  /* ---------- mot de passe oublié ---------- */
  const oubli = $('#b-oubli');
  if(oubli) oubli.onclick = async e=>{
    e.preventDefault(); err(''); okm('');
    const mail = $('#i-mail').value.trim();
    if(!mail || !mail.includes('@')) return err('Écris d’abord ton email dans la case ci-dessus.');
    try{
      await Cloud.oubli(mail, location.href.split('#')[0]);
      okm('Si un compte existe avec cet email, un lien pour changer le mot de passe vient de partir.');
    }catch(x){ err(traduire(x.message)); }
  };
  // retour depuis le lien reçu par email : on choisit un nouveau mot de passe
  const h = new URLSearchParams(location.hash.slice(1));
  if(h.get('type')==='recovery' && h.get('access_token')){
    history.replaceState(null,'',location.pathname);
    form.innerHTML = `<p class="lead">Choisis ton nouveau mot de passe.</p>
      <input class="inp" id="i-new" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe (6 caractères minimum)">
      <div class="err" id="err"></div><div class="ok" id="okmsg"></div>
      <button class="btn" id="b-new">Enregistrer</button>`;
    $('#b-new').onclick = async ()=>{
      const p = $('#i-new').value;
      if(p.length<6) return err('Le mot de passe fait 6 caractères minimum.');
      try{ await Cloud.nouveauMdp(h.get('access_token'), h.get('refresh_token'), p);
        okm('Mot de passe changé. On y va.'); setTimeout(()=>go('index.html'), 500); }
      catch(x){ err(traduire(x.message)); }
    };
  }

  // messages serveur en français
  function traduire(m){
    m = m||'';
    if(/Invalid login/i.test(m))        return 'Email ou mot de passe incorrect.';
    if(/already registered|exists/i.test(m)) return 'Un compte existe déjà avec cet email. Connecte-toi.';
    if(/Password should be/i.test(m))   return 'Mot de passe trop court (6 caractères minimum).';
    if(/rate limit|too many/i.test(m))  return 'Trop de tentatives. Réessaie dans une minute.';
    if(/not confirmed/i.test(m))        return 'Compte créé : confirme ton email (lien reçu dans ta boîte), puis connecte-toi.';
    if(/Confirme ton email/i.test(m))   return m;
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Serveur injoignable. Vérifie ta connexion.';
    return m;
  }
})();
