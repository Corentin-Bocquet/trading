/* ============================================================
   DÉFI DU JOUR (defi.html)
   Le même cycle pour tout le monde, un seul essai, classement sur la
   note de méthode. L'actif du jour reste caché ; celui d'hier est révélé.
   ============================================================ */
(async function bootDefi(){
  if(!requireAuth()) return;
  wireModeSwitch();

  const auj = jourLocal(), hier = jourLocal(Date.now()-864e5);
  const sc = defiDuJour(auj), scHier = defiDuJour(hier);

  /* ---------- compte à rebours jusqu'à minuit ---------- */
  function tic(){
    const n = new Date(), m = new Date(n); m.setHours(24,0,0,0);
    const s = Math.max(0, Math.floor((m-n)/1000));
    const p = v => String(v).padStart(2,'0');
    $('#d-fin').textContent = 'FIN DANS '+p(Math.floor(s/3600))+':'+p(Math.floor(s/60)%60)+':'+p(s%60);
    if(s===0) setTimeout(()=>location.reload(), 1500);
  }
  tic(); setInterval(tic, 1000);

  /* ---------- aperçu : les bougies telles qu'on les voit à la première manche ---------- */
  (async()=>{
    try{
      const ser = await chargerSerie(sc.a);
      const fin = sc.decs[0], deb = Math.max(sc.start, fin-70);
      const O = ser.ohlc.slice(deb, fin+1);
      const c = $('#d-apercu'), r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio||1, 2.5);
      c.width = r.width*dpr; c.height = r.height*dpr;
      const x = c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
      let lo=Infinity, hi=-Infinity; O.forEach(o=>{ lo=Math.min(lo,o[2]); hi=Math.max(hi,o[1]); });
      const W=r.width, H=r.height, cw=W/O.length, y=v=>6+(H-12)*(1-(v-lo)/((hi-lo)||1));
      O.forEach((o,i)=>{ const up=o[3]>=o[0], col=up?'#16c784':'#ea3943', xi=(i+.5)*cw;
        x.strokeStyle=col; x.fillStyle=col; x.lineWidth=1;
        x.beginPath(); x.moveTo(xi,y(o[1])); x.lineTo(xi,y(o[2])); x.stroke();
        x.fillRect(xi-cw*.32, Math.min(y(o[0]),y(o[3])), cw*.64, Math.max(1.2,Math.abs(y(o[3])-y(o[0])))); });
      x.fillStyle='rgba(10,11,13,.55)'; x.fillRect(W*.62,0,W*.38,H);
      x.fillStyle='#868d9a'; x.font='800 22px "JetBrains Mono",ui-monospace,monospace'; x.textAlign='center';
      x.fillText('? ? ?', W*.81, H/2+8);
    }catch(e){}
  })();

  /* ---------- le bouton : jouer, reprendre ou voir son résultat ---------- */
  function action(lb){
    const joue = defiJoue();
    let p = null; try{ p = JSON.parse(localStorage.getItem('cyc_partie')||'null'); }catch(e){}
    const enCours = p && p.defi===auj;
    const mien = G.hist.slice().reverse().find(h=>h.defi===auj);
    if(joue && mien){
      $('#d-action').innerHTML = `<div class="reprise"><u>TON RÉSULTAT</u>
        <b>${mien.score>0?'+':''}${String(mien.score).replace('.',',')} points de méthode</b>
        <span class="note">${lb && lb.rang ? `${lb.rang}${lb.rang===1?'er':'e'} sur ${lb.total} joueur${lb.total>1?'s':''} aujourd'hui` : 'classement en cours'}
        · reviens demain pour découvrir l'actif</span></div>`;
    }else if(joue){
      $('#d-action').innerHTML = `<p class="expl">Tu as déjà joué le défi aujourd'hui. Reviens demain.</p>`;
    }else{
      $('#d-action').innerHTML = `<a class="btn defi" href="app.html?defi=1">${enCours?'REPRENDRE LE DÉFI':'JOUER LE DÉFI'}</a>`;
    }
  }
  action(null);

  const ligne = (u,i) => `<div class="lbline${u.moi?' me':''}">
      <div class="rk">${i+1}</div>${avatar(u.pseudo, u.avatar)}
      <div class="nm">${esc(u.pseudo)}</div>
      <div class="pt">${u.score>0?'+':''}${String(u.score).replace('.',',')}</div></div>`;
  function liste(lb, vide){
    if(!lb.liste.length) return `<p class="note">${vide}</p>`;
    let l = lb.liste.slice(0,20).map(ligne).join('');
    if(lb.rang>20) l += ligne(lb.liste[lb.rang-1], lb.rang-1);
    return `<div class="lblist">${l}</div>`
      + (lb.horsLigne ? '<p class="note">Hors connexion : seul ton résultat est affiché.</p>' : '');
  }

  if(G.token){ try{ await Cloud.restore(); }catch(e){} }
  const lb = await Cloud.classementDefi(auj);
  action(lb);
  $('#d-nb').textContent = lb.total ? lb.total+' joueur'+(lb.total>1?'s':'')+" aujourd'hui" : '';
  $('#d-lb').innerHTML = liste(lb, 'Personne n’a encore joué aujourd’hui. Sois le premier.');

  /* ---------- hier : l'actif révélé et le podium ---------- */
  const an = (scHier.id.match(/-(\d{4})-(\d{2})/)||[]);
  $('#d-hier-t').textContent = 'Hier : ' + nomActif(scHier.a) + (an[1] ? ', à partir de ' + MOIS[+an[2]-1] + ' ' + an[1] : '');
  const lbH = await Cloud.classementDefi(hier);
  $('#d-hier').innerHTML = liste(lbH, 'Personne n’a joué le défi d’hier.');
})();
