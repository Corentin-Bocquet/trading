/* ============================================================
   BOOT des pages connexion / inscription
   ============================================================ */
(function bootAuth(){
  const form = $('#authform'); if(!form) return;
  const mode = form.dataset.mode;              // "login" ou "signup"
  const err = m => $('#err').textContent = m||'';
  const okm = m => { const e=$('#okmsg'); if(e) e.textContent = m||''; };

  $('#submit').onclick = async ()=>{
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
    $('#submit').textContent = 'Un instant…';
    try{
      if(mode==='signup') await Cloud.signup(mail, pass, pseudo);
      else                await Cloud.login(mail, pass);
      G.offline=false; saveLocal();
      okm('Connecté. On lance une partie.');
      setTimeout(()=>go('app.html'), 350);
    }catch(e){
      err(traduire(e.message));
      $('#submit').textContent = mode==='signup' ? 'Créer mon compte' : 'Se connecter';
    }
  };
  form.addEventListener('keydown', e=>{ if(e.key==='Enter') $('#submit').click(); });

  // messages serveur en français
  function traduire(m){
    m = m||'';
    if(/Invalid login/i.test(m))        return 'Email ou mot de passe incorrect.';
    if(/already registered|exists/i.test(m)) return 'Un compte existe déjà avec cet email. Connecte-toi.';
    if(/Password should be/i.test(m))   return 'Mot de passe trop court (6 caractères minimum).';
    if(/rate limit|too many/i.test(m))  return 'Trop de tentatives. Réessaie dans une minute.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Serveur injoignable. Vérifie ta connexion.';
    return m;
  }
})();
