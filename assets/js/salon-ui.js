/* ============================================================
   L'AFFICHAGE DES TABLES EN LIGNE
   Un seul point d'entrée, peindreJeu(), appelé à chaque état reçu.
   Chaque joueur mise sur SA caisse : elle est débitée chez lui au
   moment du geste et recréditée au règlement.
   ============================================================ */
const OL = {jeton:1, miseBj:5, relance:0, tapisFait:false};

function peindreJeu(){
  const e = S.etat;
  $$('#zone-jeu > .zjeu').forEach(z=>{
    z.style.display = (z.dataset.jeu===S.jeu) ? '' : 'none';
  });
  if(e && e.message) msgTable(e.message);
  if(S.jeu==='roulette')  peindreRouletteOL(e);
  if(S.jeu==='blackjack') peindreBlackjackOL(e);
  if(S.jeu==='poker')     peindrePokerOL(e);
}

/* ================= ROULETTE ================= */
function tapisOL(){
  if(OL.tapisFait) return;
  const N = n => `<button class="cell ${couleurDe(n)}" data-c="n${n}">${n}</button>`;
  let grille = '';
  for(let l=0;l<12;l++) for(let col=3;col>=1;col--) grille += N(l*3+col);
  const ext = c => `<button class="zone" data-c="${c}">${RL_MISES[c].nom}</button>`;
  $('#ol-tapis').innerHTML = `
    <div class="zerorow"><button class="cell vert large" data-c="n0">0</button></div>
    <div class="grille">${grille}</div>
    <div class="zones pro"><div>${ext('d1')}${ext('d2')}${ext('d3')}</div>
      <div>${ext('c1')}${ext('c2')}${ext('c3')}</div></div>
    <div class="zones"><div>${ext('manque')}${ext('pair')}
      <button class="zone rouge" data-c="rouge">ROUGE</button>
      <button class="zone noir" data-c="noir">NOIR</button>
      ${ext('impair')}${ext('passe')}</div></div>`;
  $$('#ol-tapis [data-c]').forEach(b=>{
    b.onclick = ()=>{
      const e = S.etat;
      if(!e || e.phase!=='mises') return;
      if(OL.jeton > G.prof.cashRl){ msgTable('Caisse insuffisante.'); return; }
      G.prof.cashRl -= OL.jeton; saveLocal();
      envoyerAction({type:'mise', cle:b.dataset.c, montant:OL.jeton});
      Audio_.play('coin'); peindreJeu();
    };
  });
  $$('#ol-jetons b').forEach(b=>{
    b.onclick = ()=>{ OL.jeton = +b.dataset.v; Audio_.play('click');
      $$('#ol-jetons b').forEach(x=>x.classList.toggle('on', x===b)); };
  });
  $('#ol-vider').onclick = ()=>{
    const e = S.etat; if(!e || e.phase!=='mises') return;
    const m = (e.joueurs[S.moi.id]||{}).total || 0;
    if(!m) return;
    G.prof.cashRl += m; saveLocal();
    envoyerAction({type:'vider'}); Audio_.play('click');
  };
  $('#ol-lancer').onclick = ()=>{ Audio_.wake();
    const e = S.etat; if(!e || e.phase!=='mises') return;
    const total = Object.values(e.joueurs).reduce((a,j)=>a+(j.total||0),0);
    if(total<=0){ msgTable('Personne n’a misé.'); return; }
    Audio_.play('whoosh'); envoyerAction({type:'lancer'});
  };
  OL.tapisFait = true;
  Roue.resize(); Roue.set(0,0,Roue.R*0.735,false); Roue.draw();
}

function peindreRouletteOL(e){
  tapisOL();
  if(!e) return;
  const mien = e.joueurs[S.moi.id] || {mises:{}, total:0};
  $$('#ol-tapis [data-c]').forEach(b=>{
    const m = mien.mises[b.dataset.c]||0;
    b.classList.toggle('mise', m>0);
    let j = b.querySelector('.jeton');
    if(m>0){ if(!j){ j=document.createElement('i'); j.className='jeton'; b.appendChild(j); }
             j.textContent=m; }
    else if(j) j.remove();
  });
  $('#ol-solde').textContent = fmt(G.prof.cashRl)+' €';
  $('#ol-mise').textContent  = (mien.total||0)+' €';
  $('#ol-lancer').style.display = estHote() ? '' : 'none';
  $('#ol-lancer').disabled = e.phase!=='mises';
  $('#ol-vider').disabled  = e.phase!=='mises';

  const parJoueur = S.joueurs.map(j=>{
    const x = e.joueurs[j.id]; if(!x || !x.total) return '';
    return `<s>${j.pseudo} ${x.total} €</s>`;
  }).join('');
  $('#ol-mises').innerHTML = parJoueur || '<span class="note">aucune mise posée</span>';

  if(e.phase==='resultat' && e.numero!=null){
    const c = couleurDe(e.numero);
    const gain = Object.entries(mien.mises||{})
      .reduce((a,[cle,m])=>a + (gainMise(cle,e.numero)>0 ? m*(gainMise(cle,e.numero)+1) : 0), 0);
    const net = gain - (mien.total||0);
    $('#ol-res').innerHTML = `<div class="resnum ${c}">${e.numero}</div>
      <div class="restxt">${c==='vert'?'ZÉRO':c.toUpperCase()}
        ${e.numero?'· '+(e.numero%2===0?'PAIR':'IMPAIR'):''}</div>
      <div class="resgain">${net>=0?`<b class="pos">+${net} €</b>`:`<b class="neg">−${-net} €</b>`}</div>`;
    $('#ol-res').classList.add('on');
  }else if(e.phase==='mises'){ $('#ol-res').classList.remove('on'); }
  $('#ol-etat').textContent = e.phase==='mises' ? 'PLACEZ VOS MISES'
                            : e.phase==='tourne' ? 'RIEN NE VA PLUS' : 'RÉSULTAT';
}

/* ================= BLACKJACK ================= */
function peindreBlackjackOL(e){
  if(!e) return;
  const moi = e.joueurs[S.moi.id];
  const cache = e.phase==='jeu' || e.phase==='mises';
  $('#ol-bj-croupier').innerHTML = (e.croupier||[]).map((c,i)=>carteHTML(c, cache && i===1)).join('')
    || '<span class="note">le croupier attend les mises</span>';
  $('#ol-bj-pc').textContent = (e.croupier||[]).length
    ? (cache ? pointsBJ([e.croupier[0]]).total+' +' : pointsBJ(e.croupier).total) : '';

  $('#ol-bj-mains').innerHTML = S.joueurs.map(j=>{
    const m = e.joueurs[j.id]; if(!m) return '';
    const p = pointsBJ(m.cartes||[]);
    const r = e.resultats && e.resultats[j.id];
    return `<div class="bjmain${e.tour===j.id?' actif':''}${p.total>21?' saute':''}">
      <div class="pknom">${j.pseudo}${j.id===S.moi.id?' (toi)':''}</div>
      <div class="cartes">${(m.cartes||[]).map(c=>carteHTML(c)).join('')||'<i class="note">—</i>'}</div>
      <div class="bjpts">${m.cartes&&m.cartes.length?p.total:''} · ${m.mise||0} €
        ${r?` <b class="${r.net>0?'pos':r.net<0?'neg':''}">${r.r}</b>`:''}</div>
    </div>`;
  }).join('');

  const enMise = e.phase==='mises' && (!moi || !moi.mise);
  $('#ol-bj-tapis').style.display   = enMise ? '' : 'none';
  $('#ol-bj-actions').style.display = (e.phase==='jeu' && e.tour===S.moi.id) ? '' : 'none';
  $('#ol-bj-mise').textContent = OL.miseBj+' €';
  $('#ol-bj-solde').textContent = fmt(G.prof.cashBj)+' €';
  if(e.phase==='jeu' && e.tour===S.moi.id && moi)
    $('#ol-bj-doubler').disabled = (moi.cartes||[]).length!==2 || moi.mise>G.prof.cashBj;
  $('#ol-bj-etat').textContent = e.phase==='mises' ? 'MISES'
    : e.phase==='jeu' ? (e.tour===S.moi.id ? 'À TOI' : 'AU TOUR DE '+pseudoDe(e.tour).toUpperCase())
    : e.phase==='croupier' ? 'LE CROUPIER JOUE' : 'MAIN TERMINÉE';
}

function cablerBlackjackOL(){
  $$('#ol-bj-jetons b').forEach(b=>{
    b.onclick = ()=>{ OL.miseBj = +b.dataset.v; Audio_.play('click');
      $$('#ol-bj-jetons b').forEach(x=>x.classList.toggle('on', x===b)); peindreJeu(); };
  });
  $('#ol-bj-miser').onclick = ()=>{ Audio_.wake();
    const e = S.etat; if(!e || e.phase!=='mises') return;
    if(OL.miseBj > G.prof.cashBj){ msgTable('Caisse insuffisante.'); return; }
    G.prof.cashBj -= OL.miseBj; saveLocal();
    envoyerAction({type:'mise', montant:OL.miseBj});
    Audio_.play('coin');
  };
  $('#ol-bj-tirer').onclick   = ()=>{ Audio_.play('click'); envoyerAction({type:'tirer'}); };
  $('#ol-bj-rester').onclick  = ()=>{ Audio_.play('click'); envoyerAction({type:'rester'}); };
  $('#ol-bj-doubler').onclick = ()=>{
    const moi = S.etat && S.etat.joueurs[S.moi.id]; if(!moi) return;
    if(moi.mise > G.prof.cashBj){ msgTable('Caisse insuffisante pour doubler.'); return; }
    G.prof.cashBj -= moi.mise; saveLocal();
    Audio_.play('coin'); envoyerAction({type:'doubler'});
  };
}

/* ================= POKER ================= */
function peindrePokerOL(e){
  if(!e) return;
  const assis = !!e.joueurs[S.moi.id];
  $('#ol-pk-asseoir').style.display = (!assis && e.phase==='mises') ? '' : 'none';
  $('#ol-pk-demarrer').style.display =
    (estHote() && e.phase==='mises' && Object.keys(e.joueurs).length>=2) ? '' : 'none';
  $('#ol-pk-cave').textContent = fmt(Math.min(500, G.prof.cashPk))+' €';

  $('#ol-pk-commune').innerHTML = (e.commune||[]).map(c=>carteHTML(c)).join('')
    || '<span class="note">cartes communes à venir</span>';
  $('#ol-pk-pot').textContent = fmt(e.pot||0)+' €';
  $('#ol-pk-tour').textContent = e.tourNom || '';

  $('#ol-pk-joueurs').innerHTML = S.joueurs.map(j=>{
    const x = e.joueurs[j.id]; if(!x) return '';
    const ab = e.abattage && e.abattage[j.id];
    const mienne = j.id===S.moi.id ? S.maMain : null;
    const cartes = ab || mienne;
    return `<div class="pkbot${x.couche?' couche':''}${e.tour===j.id?' actif':''}">
      <div class="pknom">${j.pseudo}${j.id===e.bouton?' <s class="bouton">D</s>':''}</div>
      <div class="cartes mini">${cartes ? cartes.map(c=>carteHTML(c)).join('')
        : (e.phase==='mises' ? '' : carteHTML(null,true)+carteHTML(null,true))}</div>
      <div class="pktapis">${fmt(x.tapis)} €${x.engage?` · mise ${x.engage} €`:''}${
        x.couche?' · couché':x.allin?' · tapis':''}</div>
    </div>`;
  }).join('');

  const moi = e.joueurs[S.moi.id];
  const monTour = e.phase==='encheres' && e.tour===S.moi.id && moi && !moi.couche && !moi.allin;
  $('#ol-pk-actions').style.display = monTour ? '' : 'none';
  if(monTour){
    const aSuivre = Math.min(e.mise - moi.engage, moi.tapis);
    $('#ol-pk-suivre').textContent = aSuivre>0 ? ('SUIVRE '+aSuivre+' €') : 'CHECK';
    const mini = e.mise + e.relanceMin;
    OL.relance = Math.max(OL.relance, mini);
    if(OL.relance > moi.engage + moi.tapis) OL.relance = moi.engage + moi.tapis;
    $('#ol-pk-relance').textContent = OL.relance+' €';
    $('#ol-pk-relancer').disabled = moi.tapis <= aSuivre;
  }else OL.relance = 0;
  $('#ol-pk-force').textContent = (S.maMain && (e.commune||[]).length && moi && !moi.couche)
    ? NOM_MAIN[meilleure7([...S.maMain, ...e.commune])[0]] : '';
  $('#ol-pk-resume').textContent = e.resume || '';
  $('#ol-pk-etat').textContent = e.phase==='mises' ? 'EN ATTENTE DES JOUEURS'
    : e.phase==='fini' ? 'ABATTAGE'
    : (e.tour===S.moi.id ? 'À TOI DE PARLER' : 'AU TOUR DE '+pseudoDe(e.tour).toUpperCase());
}

function cablerPokerOL(){
  $('#ol-pk-asseoir').onclick = ()=>{ Audio_.wake();
    const cave = Math.min(500, Math.floor(G.prof.cashPk));
    if(cave < 20){ msgTable('Il te faut au moins 20 € de cave.'); return; }
    S.horsTable = G.prof.cashPk - cave;
    Audio_.play('coin'); envoyerAction({type:'asseoir', cave});
  };
  $('#ol-pk-demarrer').onclick = ()=>{ Audio_.play('click'); envoyerAction({type:'demarrer'}); };
  $('#ol-pk-coucher').onclick  = ()=>{ Audio_.play('click'); envoyerAction({type:'coucher'}); };
  $('#ol-pk-suivre').onclick   = ()=>{ Audio_.play('coin');  envoyerAction({type:'suivre'}); };
  $('#ol-pk-relancer').onclick = ()=>{ Audio_.play('coin');
    envoyerAction({type:'relancer', montant:OL.relance}); };
  $('#ol-pk-tapis').onclick    = ()=>{ Audio_.play('coin');  envoyerAction({type:'tapis'}); };
  $('#ol-pk-moins').onclick = ()=>{ const e=S.etat; if(!e) return;
    OL.relance = Math.max(e.mise + e.relanceMin, OL.relance - e.relanceMin); peindreJeu(); };
  $('#ol-pk-plus').onclick  = ()=>{ const e=S.etat, moi=e&&e.joueurs[S.moi.id]; if(!moi) return;
    OL.relance = Math.min(moi.engage + moi.tapis, OL.relance + e.relanceMin); peindreJeu(); };
}

/* quand on quitte la table, on récupère son tapis de poker */
function avantQuitter(){
  const e = S.etat;
  if(S.jeu==='poker' && e && e.joueurs && e.joueurs[S.moi.id]){
    G.prof.cashPk = Math.max(0, Math.round((S.horsTable||0) + e.joueurs[S.moi.id].tapis));
    saveLocal(); Cloud.saveJeu('poker');
  }
}

function msgTable(t){
  const e = $('#t-msg'); if(!e) return;
  e.textContent = t; e.classList.add('on');
  clearTimeout(window._tm); window._tm = setTimeout(()=>e.classList.remove('on'), 2600);
}

function cablerJeuxOL(){ cablerBlackjackOL(); cablerPokerOL(); }
