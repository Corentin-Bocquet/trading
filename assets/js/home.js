/* ============================================================
   BOOT de l'accueil (index.html)
   Connexion obligatoire, puis choix du marché.
   ============================================================ */
(async function bootHome(){
  const box = $('#authbox');
  wireModeSwitch();
  rendreMarches();

  /* ---------- compte ---------- */
  function connecte(){
    const g = gainDe(G.prof);
    box.innerHTML = `
      <div class="walletbig" style="margin-bottom:14px">
        <u>TON PORTEFEUILLE</u>
        <b>${dollars(G.prof.cash)}</b>
        <i style="color:${g>=0?'#5fe8b6':'#ff9098'}">${g>=0?'+':'−'}$${fmt(Math.abs(g))} depuis le début${
          G.prof.ruines? ' · '+G.prof.ruines+' ruine'+(G.prof.ruines>1?'s':'') : ''}</i>
      </div>
      <button class="btn" id="b-go">JOUER — ${G.prof.pseudo}</button>
      <a class="btn ghost" href="profil.html">MON COMPTE ET LE CLASSEMENT</a>`;
    $('#b-go').onclick = ()=>{ Audio_.play('click'); go('app.html'); };
  }
  function deconnecte(){
    box.innerHTML = `
      <a class="btn" href="signup.html">CRÉER UN COMPTE</a>
      <a class="btn ghost" href="login.html">J'AI DÉJÀ UN COMPTE</a>
      <p class="expl">Un compte est nécessaire pour jouer : il garde ton portefeuille,
      ton niveau et ta place au classement.</p>`;
  }
  function horsLigneConnu(){
    box.innerHTML = `
      <button class="btn" id="b-go2">JOUER HORS CONNEXION</button>
      <p class="expl">Serveur injoignable. Tu peux jouer, la progression est gardée dans ce navigateur
      et repartira vers le serveur au retour du réseau.</p>`;
    $('#b-go2').onclick = ()=>{ Audio_.play('click'); G.offline=true; go('app.html'); };
  }
  function horsLigneInconnu(){
    box.innerHTML = `<p class="expl">Serveur injoignable pour l'instant, impossible de créer un compte.
      Réessaie dans un moment.</p>
      <button class="btn ghost" id="b-retry">RÉESSAYER</button>`;
    $('#b-retry').onclick = ()=>location.reload();
  }

  /* ---------- choix du marché ---------- */
  function rendreMarches(){
    const m = G.marche || {cat:'tout'};
    const btn = (k,nom,on) => `<button class="mbtn${on?' on':''}" data-k="${k}">${nom}</button>`;
    let html = `<h2>Sur quoi tu joues</h2>
      <div class="mgrid">${MARCHES.map(x=>btn(x.k,x.nom,m.cat===x.k)).join('')}</div>`;

    if(m.cat==='secteur'){
      html += `<div class="mgrid sub">${SECTEURS.map(s=>btn('sec:'+s.k,s.nom,m.sous===s.k)).join('')}</div>`;
    }
    if(m.cat==='entreprise'){
      const noms = Object.keys(CATALOGUE.assets)
        .filter(k=>CATALOGUE.assets[k].cat.includes('entreprise'))
        .sort((a,b)=>nomActif(a).localeCompare(nomActif(b)));
      html += `<input class="inp" id="q-ent" placeholder="Chercher une entreprise" style="margin-top:10px">
        <div class="mgrid sub" id="entlist">
          ${btn('ent:', 'AU HASARD', !m.asset)}
          ${noms.map(k=>btn('ent:'+k, nomActif(k).toUpperCase(), m.asset===k)).join('')}
        </div>`;
    }
    const info = m.cat==='entreprise' && m.asset
      ? `Tu joueras ${nomActif(m.asset)}. La période, elle, reste cachée jusqu'à la fin du cycle.`
      : (MARCHES.find(x=>x.k===m.cat)||MARCHES[0]).phrase;
    const nb = (typeof scenariosDuMarche==='function') ? 0 : 0;
    html += `<div class="mnow">MARCHÉ CHOISI : <b>${NOM_MARCHE(m)}</b></div>` + expl(info);
    $('#marchebox').innerHTML = html;

    $$('#marchebox .mbtn').forEach(b=>{
      b.onclick = ()=>{
        Audio_.play('click');
        const k = b.dataset.k;
        if(k.startsWith('sec:'))      G.marche = {cat:'secteur', sous:k.slice(4)};
        else if(k.startsWith('ent:')) G.marche = {cat:'entreprise', asset:k.slice(4)||null};
        else if(k==='secteur')        G.marche = {cat:'secteur', sous:'tech'};
        else if(k==='entreprise')     G.marche = {cat:'entreprise', asset:null};
        else                          G.marche = {cat:k};
        saveLocal(); rendreMarches();
      };
    });
    const q = $('#q-ent');
    if(q) q.oninput = ()=>{
      const t = q.value.trim().toLowerCase();
      $$('#entlist .mbtn').forEach(b=>{
        b.style.display = (!t || b.textContent.toLowerCase().includes(t)) ? '' : 'none';
      });
    };
  }

  function majJeux(){
    const t=$('#j-trading'), r=$('#j-roulette');
    if(t) t.textContent = dollars(G.prof.cash);
    if(r) r.textContent = fmt(G.prof.cashRl)+' €';
    const bj=$('#j-blackjack'), pk=$('#j-poker');
    if(bj) bj.textContent = fmt(G.prof.cashBj)+' €';
    if(pk) pk.textContent = fmt(G.prof.cashPk)+' €';
  }
  majJeux();

  if(G.token) connecte(); else deconnecte();
  const up = await Cloud.ping();
  if(!up){ G.token ? horsLigneConnu() : horsLigneInconnu(); return; }
  if(G.token){ (await Cloud.restore()) ? connecte() : deconnecte(); majJeux(); }
})();
