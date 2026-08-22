/* ============================================================
   BOOT de la page profil / classement (profil.html)
   ============================================================ */
(async function bootProfil(){
  if(!requireAuth()) return;
  wireModeSwitch();
  $('#p-lvl').textContent  = G.prof.level;
  $('#p-nom').textContent  = G.prof.pseudo;
  $('#p-meta').textContent = `${fmt(G.prof.xp)} XP · ${G.prof.sessions} cycle${G.prof.sessions>1?'s':''} joué${G.prof.sessions>1?'s':''} · record ${G.prof.best>0?'+':''}${G.prof.best}`;
  $('#p-mission').innerHTML = missionBar();

  // historique des parties
  $('#p-hist').innerHTML = G.hist.slice().reverse().slice(0,15).map(h=>{
    const v = verdictGlobal(h.score);
    return `<div class="kv"><span>${nomActif(h.a)}
      <span style="color:var(--dim)">· ${new Date(h.t).toLocaleDateString('fr-FR')}</span></span>
      <span style="display:flex;gap:8px;align-items:center"><span class="tag ${v.k}">${h.score>0?'+':''}${h.score}</span>
      <b style="font-size:11px;color:var(--dim)">+${h.xp} XP</b></span></div>`;
  }).join('') || '<p class="note">Aucune partie enregistrée pour l’instant.</p>';

  calibCanvas();

  const {list, rank, demo, moi} = await Cloud.leaderboard();
  $('#p-lb').innerHTML = leaderboard(list, rank, demo, moi);

  $('#b-out').onclick = ()=>{ localStorage.removeItem('cyc_tok'); localStorage.removeItem('cyc_ref');
    go('index.html'); };
})();
