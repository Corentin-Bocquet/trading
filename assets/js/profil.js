/* ============================================================
   BOOT de la page profil / classement (profil.html)
   ============================================================ */
(async function bootProfil(){
  if(!requireAuth()) return;
  wireModeSwitch();
  // on repart du profil serveur : identité connue, chiffres à jour
  try{ await Cloud.restore(); }catch(e){}

  /* ---------- en-tête : photo, pseudo, chiffres ---------- */
  function entete(){
    $('#p-lvl') && ($('#p-lvl').textContent = G.prof.level);
    $('#p-nom').textContent  = G.prof.pseudo;
    const prec = precisionDe(G.prof);
    $('#p-meta').textContent = `niveau ${G.prof.level} · ${fmt(G.prof.xp)} XP`
      + (prec!=null ? ` · ${prec} % de bonnes décisions` : '')
      + ` · ${G.prof.sessions} cycle${G.prof.sessions>1?'s':''}`;
    const av = $('#p-avin');
    if(G.prof.avatar){ av.style.backgroundImage = `url('${G.prof.avatar}')`; av.textContent = ''; }
    else { av.style.backgroundImage = 'none';
           av.textContent = (G.prof.pseudo||'?')[0].toUpperCase(); }
  }
  entete();
  $('#p-mission').innerHTML = missionBar();

  /* ---------- édition du profil ---------- */
  const box = $('#p-edit');
  let photoEnCours = G.prof.avatar;          // valeur en attente d'enregistrement

  function ouvrir(){
    photoEnCours = G.prof.avatar;
    $('#e-pseudo').value = G.prof.pseudo;
    $('#e-err').textContent = ''; $('#e-ok').textContent = '';
    box.classList.add('on');
    $('#e-pseudo').focus();
  }
  function fermer(){ box.classList.remove('on'); entete(); }
  $('#p-editbtn').onclick = ()=>{ Audio_.play('click'); box.classList.contains('on') ? fermer() : ouvrir(); };
  $('#p-av').onclick      = ()=>{ Audio_.play('click'); if(!box.classList.contains('on')) ouvrir();
                                  $('#e-file').click(); };
  $('#e-photo').onclick   = ()=>{ Audio_.play('click'); $('#e-file').click(); };
  $('#e-cancel').onclick  = ()=>{ Audio_.play('click'); fermer(); };
  $('#e-rm').onclick      = ()=>{ Audio_.play('click'); photoEnCours = null;
    $('#p-avin').style.backgroundImage='none';
    $('#p-avin').textContent=($('#e-pseudo').value||'?')[0].toUpperCase(); };

  // redimensionne et compresse côté navigateur : rien d'énorme ne part sur le réseau
  function preparerPhoto(file){
    return new Promise((res,rej)=>{
      const fr = new FileReader();
      fr.onerror = ()=>rej(new Error('Fichier illisible.'));
      fr.onload  = ()=>{
        const img = new Image();
        img.onerror = ()=>rej(new Error('Ce fichier n’est pas une image.'));
        img.onload  = ()=>{
          try{
            const cadre = (S,q)=>{
              const c = document.createElement('canvas'); c.width = c.height = S;
              const x = c.getContext('2d');
              const m = Math.min(img.width, img.height);     // recadrage carré centré
              x.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, S, S);
              return c.toDataURL('image/jpeg', q);
            };
            let d = cadre(128, .72);
            if(d.length > 40000) d = cadre(96, .6);          // garde-fou de taille
            res(d);
          }catch(e){ rej(new Error('Image impossible à traiter.')); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  $('#e-file').onchange = async e=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    $('#e-err').textContent = ''; $('#e-ok').textContent = '';
    if(f.size > 12*1024*1024) return $('#e-err').textContent = 'Image trop lourde (12 Mo maximum).';
    try{
      photoEnCours = await preparerPhoto(f);
      $('#p-avin').style.backgroundImage = `url('${photoEnCours}')`;
      $('#p-avin').textContent = '';
      $('#e-ok').textContent = 'Photo prête. Pense à enregistrer.';
    }catch(err){ $('#e-err').textContent = err.message; }
    e.target.value = '';
  };

  $('#e-save').onclick = async ()=>{
    const pseudo = $('#e-pseudo').value.trim();
    $('#e-err').textContent=''; $('#e-ok').textContent='';
    if(pseudo.length < 2)  return $('#e-err').textContent = 'Le pseudo fait 2 caractères minimum.';
    if(pseudo.length > 18) return $('#e-err').textContent = 'Le pseudo fait 18 caractères maximum.';
    $('#e-save').textContent = 'Un instant…';
    try{
      await Cloud.saveProfil({pseudo, avatar:photoEnCours});
      Audio_.play('win');
      $('#e-ok').textContent = 'Profil enregistré.';
      entete(); rendreClassement();
      setTimeout(fermer, 500);
    }catch(err){
      $('#e-err').textContent = /Failed to fetch/i.test(err.message)
        ? 'Serveur injoignable, réessaie dans un moment.' : err.message;
    }
    $('#e-save').textContent = 'Enregistrer';
  };

  /* ---------- réglages ---------- */
  const sw = $('#s-gate');
  function peindre(){ sw.classList.toggle('on', G.gateOn);
    sw.setAttribute('aria-checked', G.gateOn?'true':'false'); }
  peindre();
  sw.onclick = ()=>{ G.gateOn = !G.gateOn; saveLocal(); peindre(); Audio_.play('click'); };

  /* ---------- historique des parties ---------- */
  $('#p-hist').innerHTML = G.hist.slice().reverse().slice(0,15).map(h=>{
    const v = verdictGlobal(h.score);
    return `<div class="kv"><span>${nomActif(h.a)}
      <span style="color:var(--dim)">· ${new Date(h.t).toLocaleDateString('fr-FR')}</span></span>
      <span style="display:flex;gap:8px;align-items:center"><span class="tag ${v.k}">${h.score>0?'+':''}${h.score}</span>
      <b style="font-size:11px;color:var(--dim)">+${h.xp} XP</b></span></div>`;
  }).join('') || '<p class="note">Aucune partie enregistrée pour l’instant.</p>';

  calibCanvas();

  /* ---------- classement : XP ou précision ---------- */
  let LB = null, metric = localStorage.getItem('cyc_metric') || 'xp';
  function rendreClassement(){
    if(!LB) return;
    $('#p-lb').innerHTML = leaderboard(LB.list, LB.rank, LB.demo, LB.moi, metric);
    document.querySelectorAll('.lbtabs b').forEach(b=>{
      b.onclick = ()=>{ if(metric===b.dataset.k) return;
        Audio_.play('click'); metric = b.dataset.k;
        localStorage.setItem('cyc_metric', metric); rendreClassement(); };
    });
  }
  LB = await Cloud.leaderboard();
  rendreClassement();

  $('#b-out').onclick = ()=>{ localStorage.removeItem('cyc_tok');
    localStorage.removeItem('cyc_ref'); go('index.html'); };
})();
