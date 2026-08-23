/* ============================================================
   BOOT de la page compte (profil.html)
   ============================================================ */
(async function bootProfil(){
  if(!requireAuth()) return;
  wireModeSwitch();
  try{ await Cloud.restore(); }catch(e){}

  /* ---------- en-tête ---------- */
  function entete(){
    $('#p-nom').textContent = G.prof.pseudo;
    const prec = precisionDe(G.prof);
    $('#p-meta').textContent = `niveau ${G.prof.level} · ${fmt(G.prof.xp)} XP`
      + (prec!=null ? ` · ${prec} % de bonnes décisions` : '')
      + ` · ${G.prof.sessions} cycle${G.prof.sessions>1?'s':''}`;
    const av = $('#p-avin');
    if(G.prof.avatar){ av.style.backgroundImage = `url('${G.prof.avatar}')`; av.textContent=''; }
    else { av.style.backgroundImage='none'; av.textContent=(G.prof.pseudo||'?')[0].toUpperCase(); }
    const g = gainDe(G.prof);
    $('#p-wallet').innerHTML = `<u>TRADING</u><b>${dollars(G.prof.cash)}</b>
      <i style="color:${g>=0?'#5fe8b6':'#ff9098'}">${g>=0?'+':'−'}$${fmt(Math.abs(g))} depuis le début</i>
      ${G.prof.ruines?`<span class="ruine big">${G.prof.ruines} RUINE${G.prof.ruines>1?'S':''}</span>`:''}`;
    const w2 = $('#p-wallet-rl');
    if(w2){ const gr = gainRlDe(G.prof);
      w2.innerHTML = `<u>ROULETTE</u><b>${fmt(G.prof.cashRl)} €</b>
      <i style="color:${gr>=0?'#5fe8b6':'#ff9098'}">${gr>=0?'+':'−'}${fmt(Math.abs(gr))} € · ${fmt(G.prof.toursRl||0)} tours</i>
      ${G.prof.ruinesRl?`<span class="ruine big">${G.prof.ruinesRl} RUINE${G.prof.ruinesRl>1?'S':''}</span>`:''}`; }
  }
  entete();
  $('#p-mission').innerHTML = missionBar();

  /* ---------- édition du profil ---------- */
  const box = $('#p-edit');
  let photoEnCours = G.prof.avatar;
  function ouvrir(){ photoEnCours=G.prof.avatar; $('#e-pseudo').value=G.prof.pseudo;
    $('#e-err').textContent=''; $('#e-ok').textContent=''; box.classList.add('on'); $('#e-pseudo').focus(); }
  function fermer(){ box.classList.remove('on'); entete(); }
  $('#p-editbtn').onclick = ()=>{ Audio_.play('click'); box.classList.contains('on')?fermer():ouvrir(); };
  $('#p-av').onclick = ()=>{ Audio_.play('click'); if(!box.classList.contains('on')) ouvrir(); $('#e-file').click(); };
  $('#e-photo').onclick = ()=>{ Audio_.play('click'); $('#e-file').click(); };
  $('#e-cancel').onclick = ()=>{ Audio_.play('click'); fermer(); };
  $('#e-rm').onclick = ()=>{ Audio_.play('click'); photoEnCours=null;
    $('#p-avin').style.backgroundImage='none';
    $('#p-avin').textContent=($('#e-pseudo').value||'?')[0].toUpperCase(); };

  function preparerPhoto(file){
    return new Promise((res,rej)=>{
      const fr=new FileReader();
      fr.onerror=()=>rej(new Error('Fichier illisible.'));
      fr.onload=()=>{ const img=new Image();
        img.onerror=()=>rej(new Error('Ce fichier n’est pas une image.'));
        img.onload=()=>{ try{
            const cadre=(S,q)=>{ const c=document.createElement('canvas'); c.width=c.height=S;
              const x=c.getContext('2d'); const m=Math.min(img.width,img.height);
              x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);
              return c.toDataURL('image/jpeg',q); };
            let d=cadre(128,.72); if(d.length>40000) d=cadre(96,.6); res(d);
          }catch(e){ rej(new Error('Image impossible à traiter.')); } };
        img.src=fr.result; };
      fr.readAsDataURL(file);
    });
  }
  $('#e-file').onchange = async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    $('#e-err').textContent=''; $('#e-ok').textContent='';
    if(f.size>12*1024*1024) return $('#e-err').textContent='Image trop lourde (12 Mo maximum).';
    try{ photoEnCours=await preparerPhoto(f);
      $('#p-avin').style.backgroundImage=`url('${photoEnCours}')`; $('#p-avin').textContent='';
      $('#e-ok').textContent='Photo prête. Pense à enregistrer.';
    }catch(err){ $('#e-err').textContent=err.message; }
    e.target.value='';
  };
  $('#e-save').onclick = async ()=>{
    const pseudo=$('#e-pseudo').value.trim();
    $('#e-err').textContent=''; $('#e-ok').textContent='';
    if(pseudo.length<2)  return $('#e-err').textContent='Le pseudo fait 2 caractères minimum.';
    if(pseudo.length>18) return $('#e-err').textContent='Le pseudo fait 18 caractères maximum.';
    $('#e-save').textContent='UN INSTANT…';
    try{ await Cloud.saveProfil({pseudo, avatar:photoEnCours}); Audio_.play('win');
      $('#e-ok').textContent='Profil enregistré.'; entete(); rendreClassement(); setTimeout(fermer,500);
    }catch(err){ $('#e-err').textContent=/Failed to fetch/i.test(err.message)
        ? 'Serveur injoignable, réessaie dans un moment.' : err.message; }
    $('#e-save').textContent='ENREGISTRER';
  };

  /* ---------- réglages ---------- */
  const sw=$('#s-gate');
  function peindre(){ sw.classList.toggle('on',G.gateOn); sw.setAttribute('aria-checked',G.gateOn?'true':'false'); }
  peindre();
  sw.onclick=()=>{ G.gateOn=!G.gateOn; saveLocal(); peindre(); Audio_.play('click'); };

  const swn=$('#s-notif');
  async function peindreNotif(){
    const e = await Notif.etat();
    swn.classList.toggle('on', e==='actif');
    swn.setAttribute('aria-checked', e==='actif'?'true':'false');
    swn.classList.toggle('off', e==='indisponible');
  }
  peindreNotif();
  swn.onclick = async ()=>{
    Audio_.play('click'); $('#n-err').textContent='';
    try{
      const e = await Notif.etat();
      if(e==='actif') await Notif.desactiver(); else await Notif.activer();
    }catch(err){ $('#n-err').textContent = err.message; }
    peindreNotif();
  };

  /* ---------- historique ---------- */
  $('#p-hist').innerHTML = G.hist.slice().reverse().slice(0,15).map(h=>{
    const gain = h.gain!=null ? h.gain : 0;
    return `<div class="kv"><span>${nomActif(h.a)}
      <span style="color:var(--dim)">· ${new Date(h.t).toLocaleDateString('fr-FR')}</span></span>
      <span style="display:flex;gap:9px;align-items:center">
      <b style="color:${gain>=0?'#5fe8b6':'#ff9098'}">${gain>=0?'+':'−'}$${fmt(Math.abs(gain))}</b>
      <b style="font-size:11px;color:var(--dim)">+${h.xp} XP</b></span></div>`;
  }).join('') || '<p class="note">Aucun cycle joué pour l’instant.</p>';

  calibCanvas();

  /* ---------- classement ---------- */
  let LB=null, mesure=localStorage.getItem('cyc_mesure')||'argent', tout=false;
  function rendreClassement(){
    if(!LB) return;
    $('#p-lb').innerHTML = leaderboard(LB.list, LB.rank, LB.demo, LB.moi, mesure, tout);
    $$('.lbtabs b[data-k]').forEach(b=>{
      b.onclick=()=>{ if(mesure===b.dataset.k) return;
        Audio_.play('click'); mesure=b.dataset.k;
        localStorage.setItem('cyc_mesure',mesure); rendreClassement(); };
    });
    $$('.lbtabs b[data-j]').forEach(b=>{
      b.onclick=()=>{ Audio_.play('click');
        mesure = b.dataset.j==='roulette' ? 'caisse' : 'argent';
        localStorage.setItem('cyc_mesure',mesure); rendreClassement(); };
    });
    const more=$('#b-lbmore');
    if(more) more.onclick=()=>{ Audio_.play('click'); tout=!tout; rendreClassement(); };
    brancherLignes(LB.list);
  }
  LB = await Cloud.leaderboard();
  rendreClassement();

  $('#b-out').onclick = ()=>{ localStorage.removeItem('cyc_tok');
    localStorage.removeItem('cyc_ref'); go('index.html'); };
})();
