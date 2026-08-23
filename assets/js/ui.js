/* ============================================================
   INTERFACE : barre de missions, classement, montée de niveau,
   courbe de progression, écrans de bilan.
   Règle de cette interface : un mot, jamais un pictogramme seul.
   ============================================================ */
function athAt(i){ let m=0; for(let k=0;k<=i;k++) if(G.ser.ohlc[k][1]>m) m=G.ser.ohlc[k][1]; return m; }

/* encadré d'explication : une phrase, mise en valeur */
function expl(txt){ return `<p class="expl">${txt}</p>`; }

/* --- barre de progression "missions" --- */
function missionBar(){
  const total = missionsNiveau();
  const done = clamp(missionDone(), 0, total), reste = total-done;
  const p = done/total;
  let dots='';
  for(let k=0;k<Math.min(reste,9);k++) dots += '<s class="'+(k===0?'hot':'')+'"></s>';
  return `<div class="missionwrap"><div class="missioncard">
    <div class="mtop">
      <div class="mico"><b>${G.prof.level}</b><u>NIVEAU</u></div>
      <div class="mtxt"><b>Niveau ${G.prof.level}.</b> Encore ${reste} bonne${reste>1?'s':''} décision${reste>1?'s':''} pour passer au niveau ${G.prof.level+1}.</div>
    </div>
    <div class="mtrack">
      <div class="mfill" style="width:${clamp(p*100,9,100)}%"></div>
      <div class="mdots" style="left:calc(${clamp(p*100,9,100)}% + 16px);right:16px;justify-content:space-around">${dots}</div>
    </div>
    <div class="mfoot"><span>${done} sur ${total}</span>
      <span>${(G.prof.level+1)%5===0?'palier difficile':'niveau '+(G.prof.level+1)}</span></div>
  </div></div>`;
}

/* --- classement --- */
const SPARK='<svg width="13" height="13" viewBox="0 0 24 24" style="flex:0 0 auto"><path d="M12 0c.6 6.2 5.2 10.8 12 12-6.8 1.2-11.4 5.8-12 12-.6-6.2-5.2-10.8-12-12C6.8 10.8 11.4 6.2 12 0z" fill="currentColor"/></svg>';
const AVCOL=['#e0648a','#5b8def','#3fbf8f','#8b5cf6','#f59e0b','#ef4444'];
function avatar(nom, photo){
  if(photo) return `<div class="av photo" style="background-image:url('${photo}')"></div>`;
  let h=0; for(const c of (nom||'?')) h=(h*31+c.charCodeAt(0))|0;
  const col=AVCOL[Math.abs(h)%AVCOL.length];
  return `<div class="av" style="background:linear-gradient(150deg,${col},${col}99)">${(nom||'?')[0].toUpperCase()}</div>`;
}

const MESURES = {
  argent: {jeu:'trading', nom:'ARGENT',
    val: u => dollars(u.cash!=null?u.cash:CAPITAL_DEPART),
    tri: (a,b) => (b.cash||0)-(a.cash||0),
    mien: () => dollars(G.prof.cash),
    phrase:'Ce qu’il reste dans le portefeuille de trading. Tout le monde a commencé avec 10 000 $.'},
  gain:   {jeu:'trading', nom:'GAIN',
    val: u => (gainDe(u)>=0?'+':'−')+'$'+fmt(Math.abs(gainDe(u))),
    tri: (a,b) => gainDe(b)-gainDe(a),
    mien: () => (gainDe(G.prof)>=0?'+':'−')+'$'+fmt(Math.abs(gainDe(G.prof))),
    phrase:'Tout ce que le joueur a gagné ou perdu en trading depuis son premier cycle, remises à zéro comprises.'},
  decisions:{jeu:'trading', nom:'DÉCISIONS',
    val: u => precisionDe(u)!=null ? precisionDe(u)+' %' : '—',
    tri: (a,b) => { const pa=precisionDe(a),pb=precisionDe(b);
      if(pa==null&&pb==null) return b.xp-a.xp;
      if(pa==null) return 1; if(pb==null) return -1; return pb-pa; },
    mien: () => precisionDe(G.prof)!=null ? precisionDe(G.prof)+' %' : 'pas encore classé',
    phrase:'Sur 100 décisions prises, combien étaient posées dans la bonne zone du cycle. Compté à partir de '+MIN_DECISIONS+' décisions.'},

  caisse: {jeu:'roulette', nom:'CAISSE',
    val: u => fmt(u.cashRl!=null?u.cashRl:RL_DEPART)+' €',
    tri: (a,b) => (b.cashRl||0)-(a.cashRl||0),
    mien: () => fmt(G.prof.cashRl)+' €',
    phrase:'Ce qu’il reste dans la caisse roulette. Tout le monde a commencé avec 50 €.'},
  gainrl: {jeu:'roulette', nom:'GAIN',
    val: u => (gainRlDe(u)>=0?'+':'−')+fmt(Math.abs(gainRlDe(u)))+' €',
    tri: (a,b) => gainRlDe(b)-gainRlDe(a),
    mien: () => (gainRlDe(G.prof)>=0?'+':'−')+fmt(Math.abs(gainRlDe(G.prof)))+' €',
    phrase:'Gagné ou perdu à la roulette depuis le début. Sur la durée ce chiffre baisse pour tout le monde : c’est mathématique, la banque garde 2,7 % de chaque mise.'},
  tours:  {jeu:'roulette', nom:'TOURS',
    val: u => fmt(u.toursRl||0),
    tri: (a,b) => (b.toursRl||0)-(a.toursRl||0),
    mien: () => fmt(G.prof.toursRl||0),
    phrase:'Nombre de tours de roulette joués. Ça ne mesure pas l’adresse, seulement l’appétit.'}
};

function badgeRuines(u, jeu){
  const r = jeu==='roulette' ? (u.ruinesRl||0) : (u.ruines||0);
  return r ? `<span class="ruine">${r} RUINE${r>1?'S':''}</span>` : '';
}
function badgeSerie(u){
  const s = u.streak||0;
  return s>=2 ? `<span class="serie">SÉRIE ${s}</span>` : '';
}

function leaderboard(list, rang, demo, moi, mesure, tout){
  mesure = MESURES[mesure] ? mesure : 'argent';
  const M = MESURES[mesure], jeu = M.jeu;
  const tri = list.slice().sort(M.tri);
  const estMoi = u => moi && u.pseudo===moi.pseudo && u.xp===moi.xp;
  const badges = u => badgeRuines(u,jeu) + badgeSerie(u);

  const pill = (u,i)=>`
    <div class="lbrow r${i+1}${estMoi(u)?' me':''}" data-p="${encodeURIComponent(u.pseudo)}">
      <div class="rk">${i+1}</div>${avatar(u.pseudo, u.avatar)}
      <div class="nm">${u.pseudo}${badges(u)}</div>
      <div class="pt">${M.val(u)} ${SPARK}</div>
    </div>`;
  const ligne = (u,i)=>`
    <div class="lbline${estMoi(u)?' me':''}" data-p="${encodeURIComponent(u.pseudo)}">
      <div class="rk">${i+1}</div>${avatar(u.pseudo, u.avatar)}
      <div class="nm">${u.pseudo}${badges(u)}</div>
      <div class="pt">${M.val(u)}</div>
    </div>`;

  const corps = tout
    ? `<div class="lblist">${tri.slice(0,20).map(ligne).join('')}</div>`
    : `<div class="lbwrap"><div class="lbstack">${tri.slice(0,5).map(pill).join('')}</div></div>`;

  const monRang = tri.findIndex(estMoi)+1;
  const jeux = `<div class="lbtabs jeux2">
      <b data-j="trading" class="${jeu==='trading'?'on':''}">TRADING</b>
      <b data-j="roulette" class="${jeu==='roulette'?'on':''}">ROULETTE</b></div>`;
  const onglets = `<div class="lbtabs">` +
    Object.keys(MESURES).filter(k=>MESURES[k].jeu===jeu)
      .map(k=>`<b data-k="${k}" class="${k===mesure?'on':''}">${MESURES[k].nom}</b>`).join('') +
    `</div>`;
  const bouton = `<button class="lbmore" id="b-lbmore">${tout?'RÉDUIRE':'VOIR TOUT LE CLASSEMENT'}</button>`;
  const rank = `<div class="lbme">TON RANG : ${monRang>0?'#'+monRang:'non classé'} · ${M.mien()}</div>`;
  const dem = demo?expl('Classement de démonstration. Crée un compte pour être classé face aux vrais joueurs.'):'';
  return jeux + onglets + corps + rank + bouton
       + expl(M.phrase + ' Appuie sur un joueur pour voir sa fiche.')
       + expl('Le badge <b>SÉRIE</b> est le nombre de jours d’affilée où le joueur est venu jouer, au trading ou à la roulette.')
       + dem;
}

/* --- fiche d'un joueur, ouverte depuis le classement --- */
async function ouvrirFiche(pseudo, liste){
  const u = (liste||[]).find(x=>x.pseudo===pseudo);
  if(!u) return;
  const el = $('#fiche'); if(!el) return;
  const prec = precisionDe(u);
  el.innerHTML = `<div class="inner">
    <div class="phead">
      ${avatar(u.pseudo,u.avatar).replace('class="av"','class="av gros"').replace('class="av photo"','class="av photo gros"')}
      <div class="pinfo"><div class="prow"><span>${u.pseudo}</span></div>
        <div class="note">niveau ${u.level||1} · ${fmt(u.xp||0)} XP${u.streak?` · série ${u.streak} j`:''}</div></div>
      <button class="wordbtn sm" id="f-close">FERMER</button>
    </div>
    <div class="statgrid" style="margin-top:16px">
      <div><u>TRADING</u><b>${dollars(u.cash!=null?u.cash:CAPITAL_DEPART)}</b></div>
      <div><u>GAIN</u><b>${(gainDe(u)>=0?'+':'−')}$${fmt(Math.abs(gainDe(u)))}</b></div>
      <div><u>DÉCISIONS</u><b>${prec!=null?prec+' %':'—'}</b></div>
      <div><u>ROULETTE</u><b>${fmt(u.cashRl!=null?u.cashRl:RL_DEPART)} €</b></div>
      <div><u>TOURS</u><b>${fmt(u.toursRl||0)}</b></div>
      <div><u>RUINES</u><b>${(u.ruines||0)+(u.ruinesRl||0)}</b></div>
    </div>
    <h2>Son argent dans le temps</h2>
    <canvas id="f-courbe" style="width:100%;height:150px;display:block"></canvas>
    <h2>Ses derniers cycles</h2>
    <div id="f-hist"><p class="note">Chargement…</p></div>
  </div>`;
  el.classList.add('on');
  $('#f-close').onclick = ()=>{ Audio_.play('click'); el.classList.remove('on'); };

  const h = await Cloud.sessionsDe(pseudo);
  courbeArgent('f-courbe', h);
  $('#f-hist').innerHTML = h.slice().reverse().slice(0,12).map(x=>`
    <div class="kv"><span>${nomActif(x.a)}
      <span style="color:var(--dim)">· ${new Date(x.t).toLocaleDateString('fr-FR')}</span></span>
    <b style="color:${x.gain>=0?'#5fe8b6':'#ff9098'}">${x.gain>=0?'+':'−'}$${fmt(Math.abs(x.gain))}</b></div>`
  ).join('') || '<p class="note">Aucun cycle enregistré.</p>';
}

function brancherLignes(liste){
  $$('.lbrow[data-p],.lbline[data-p]').forEach(r=>{
    r.onclick = ()=>{ Audio_.play('click'); ouvrirFiche(decodeURIComponent(r.dataset.p), liste); };
  });
}

/* --- montée de niveau --- */
function levelUpAnim(n){
  Audio_.play('levelup');
  const el=$('#levelup'); $('#lu-n').textContent=n;
  $('#lu-p').textContent = ['Tu lis mieux les zones.','Tu dézoomes par réflexe maintenant.',
    'Tes paliers deviennent réguliers.','La patience commence à payer.'][n%4];
  el.classList.add('on');
  for(let k=0;k<26;k++){
    const s=document.createElement('div'); s.className='spark';
    const a=Math.random()*Math.PI*2, d=90+Math.random()*180;
    s.style.cssText=`left:50%;top:45%;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;
      animation:fly ${.7+Math.random()*.7}s ease-out forwards;
      background:${Math.random()>.5?'#ffd34d':'#b8ec2f'}`;
    el.appendChild(s); setTimeout(()=>s.remove(),1600);
  }
  setTimeout(()=>el.classList.remove('on'), 2600);
}

/* --- courbe : l'argent du portefeuille dans le temps --- */
function courbeArgent(id, hist){
  setTimeout(()=>{
    const c=document.getElementById(id); if(!c) return;
    const dpr=Math.min(devicePixelRatio||1,2.5), r=c.getBoundingClientRect();
    c.width=r.width*dpr; c.height=r.height*dpr;
    const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
    const H=r.height,W=r.width;
    const d=(hist||[]).slice(-24).filter(v=>v.cash!=null);
    x.clearRect(0,0,W,H);
    if(d.length<1){ x.fillStyle='#5b626e'; x.font='13px sans-serif'; x.textAlign='center';
      x.fillText('Aucun cycle joué pour l’instant', W/2, H/2); return; }
    const vals=[CAPITAL_DEPART,...d.map(v=>v.cash)];
    const lo=Math.min(...vals)*.92, hi=Math.max(...vals)*1.08;
    const px=i=> d.length===1? W/2 : 14+i*(W-28)/(d.length-1);
    const py=v=> H-18-((v-lo)/(hi-lo))*(H-32);
    const y0=py(CAPITAL_DEPART)+.5;
    x.strokeStyle='#2a2f39'; x.setLineDash([4,4]); x.lineWidth=1;
    x.beginPath(); x.moveTo(0,y0); x.lineTo(W,y0); x.stroke(); x.setLineDash([]);
    x.fillStyle='#5b626e'; x.font='10px ui-monospace,monospace'; x.textAlign='left';
    x.fillText('10 000 $', 4, y0-6);
    x.strokeStyle='#f5a524'; x.lineWidth=2; x.beginPath();
    d.forEach((v,i)=> i? x.lineTo(px(i),py(v.cash)) : x.moveTo(px(i),py(v.cash)));
    x.stroke();
    d.forEach((v,i)=>{ x.fillStyle = v.ruine?'#ea3943':(v.gain>=0?'#16c784':'#868d9a');
      x.beginPath(); x.arc(px(i),py(v.cash),3.6,0,7); x.fill(); });
  },30);
}
function calibCanvas(){ courbeArgent('calib', G.hist); }

/* ============================================================
   BILAN — version SIMPLE
   ============================================================ */
function renderResultSimple(R){
  const {sc,ser,buys,pru,zPru,score,valeur,xpGain,avant,gainCycle,ruine}=R;
  const n = score>=12?5 : score>=8?4 : score>=5?3 : score>=0?2 : 1;
  const pastilles = Array.from({length:5},(_,i)=>`<s class="${i<n?'on':''}"></s>`).join('');
  const perf = avant>0 ? (gainCycle/avant*100) : 0;
  const sousSommet = pru!=null ? Math.max(0, Math.round((1-pru/sc.pPk0)*100)) : null;
  const an = i => ser.dates[i].slice(0,4);

  $('#res-body').innerHTML = `
  <div class="sres">
    <div class="pastilles">${pastilles}</div>
    <div class="asset">${ser.nom}</div>
    <div class="years">${an(G.decs[0])} → ${an(sc.end)}<span style="opacity:.45"> · creux ${an(sc.tr)}</span></div>

    <div class="mult" style="color:${perf>=0?'#5fe8b6':'#ff9098'}">${perf>=0?'+':'−'}${Math.abs(perf).toFixed(0)} %</div>
    <div class="xp">${gainCycle>=0?'+':'−'}$${fmt(Math.abs(gainCycle))} sur ce cycle</div>

    ${ruine ? `<div class="ruinebox">TU AS TOUT PERDU<span>portefeuille remis à 10 000 $ · ${G.prof.ruines} ruine${G.prof.ruines>1?'s':''} au total</span></div>` : ''}

    <div class="wallet">
      <u>TON PORTEFEUILLE</u>
      <b>${dollars(G.prof.cash)}</b>
    </div>

    <div class="mini">
      <div><u>PALIERS</u><b>${buys.length}</b></div>
      ${sousSommet!=null?`<div><u>ACHAT MOYEN</u><b>−${sousSommet}%</b></div>`:''}
      <div><u>GAGNÉ</u><b>+${xpGain} XP</b></div>
    </div>
    ${expl(sousSommet!=null
      ? `Tu as acheté en moyenne ${sousSommet} % sous le sommet précédent. Plus ce chiffre est grand, mieux c’est.`
      : `Tu n’as posé aucun palier sur ce cycle.`)}

    <div style="width:100%;margin-top:22px">${missionBar()}</div>
    <button class="bigbtn" id="b-again">REJOUER</button>
    <div class="row2">
      <button class="wordbtn" id="b-seechart">VOIR LE GRAPHIQUE</button>
      <button class="wordbtn" id="b-prof">CLASSEMENT</button>
    </div>
  </div>`;
  brancherBilan(sc);
}

function brancherBilan(sc){
  $('#b-again').onclick    = ()=>{ Audio_.play('click');
    if(typeof peindreSetup==='function') peindreSetup();
    show('s-setup'); };
  $('#b-seechart').onclick = ()=>{ Audio_.play('click'); G.view.span = sc.end-sc.start+1;
    G.endVisible = sc.end; show('s-game'); Chart.resize(); Chart.draw(); };
  $('#b-prof').onclick     = ()=>{ Audio_.play('click'); go('profil.html'); };
}

/* ============================================================
   BILAN — version PRO
   ============================================================ */
function renderResult(R){
  if(G.mode==='simple') return renderResultSimple(R);
  const {sc,ser,last,buys,sells,pru,zPru,score,bonus,valeur,bh,xpGain,bons,
         avant,gainCycle,ruine,diff}=R;
  const v = verdictGlobal(score);
  const d0 = ser.dates[G.decs[0]], d1 = ser.dates[sc.end];
  const isBTC = sc.a==='BTC';

  const ligne = a => {
    const lbl = a.type==='buy'?'Achat '+Math.round(a.pct*100)+'%'
             : a.type==='sell'?'Encaissé '+Math.round(a.pct*100)+'%' : 'Attente';
    return `<div class="kv"><span style="display:flex;flex-direction:column;gap:3px">
      <span>${lbl} <span style="color:var(--dim)">· ${dateFr(a.date)}</span></span>
      <span class="note">${a.g.d}</span></span>
      <span style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
      <span class="tag ${a.g.k}">${a.g.t}</span>
      <b style="font-size:11px;color:var(--dim)">zone ${Math.round(clamp(a.zone,0,1.4)*100)}% · ${a.gained>0?'+':''}${a.gained} pt</b></span></div>`;
  };

  const infos = buys.map(a=>{
    const ath = athAt(a.i), dd = 1 - a.price/ath, ma = ser.ma200[a.i];
    const h = isBTC ? halvingInfo(a.date) : null;
    return `<div class="kv"><span>${dateFr(a.date)}</span>
      <b style="font-size:11.5px;text-align:right">−${(dd*100).toFixed(0)}% sous le sommet${
        ma?` · ${a.price>=ma?'+':'−'}${Math.abs((a.price/ma-1)*100).toFixed(0)}% vs MM200`:''}${
        h&&h.joursDepuis!=null?` · J+${h.joursDepuis} après halving`:''}</b></div>`;
  }).join('') || '<p class="note">Aucun palier posé sur ce cycle.</p>';

  $('#res-body').innerHTML = `
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-size:10.5px;letter-spacing:.22em;color:var(--gold);font-weight:800">RÉSULTAT</div>
      <h1 style="margin:8px 0 2px">${ser.nom}</h1>
      <div class="note" style="font-size:13px">${dateFr(d0)} → ${dateFr(d1)} · repli du cycle : −${sc.dd} %
      · difficulté ×${String(diff).replace('.',',')}</div>
    </div>

    <div class="walletbig">
      <u>TON PORTEFEUILLE</u>
      <b>${dollars(G.prof.cash)}</b>
      <i style="color:${gainCycle>=0?'#5fe8b6':'#ff9098'}">${gainCycle>=0?'+':'−'}$${fmt(Math.abs(gainCycle))} sur ce cycle
        (${gainCycle>=0?'+':'−'}${Math.abs(gainCycle/avant*100).toFixed(0)} %)</i>
    </div>
    ${ruine ? `<div class="ruinebox">TU AS TOUT PERDU<span>portefeuille remis à 10 000 $ · ${G.prof.ruines} ruine${G.prof.ruines>1?'s':''} au total</span></div>` : ''}
    ${expl('Ton portefeuille repart de là au prochain cycle. Il ne se remet à 10 000 $ que si tu perds tout.')}

    <div style="text-align:center;margin:22px 0">
      <span class="tag ${v.k}" style="font-size:12px;padding:7px 13px">${v.t}</span>
      <div class="num" style="font-size:44px;font-weight:800;margin-top:12px">${score>0?'+':''}${score}</div>
      <div class="note">points de méthode · record : ${G.prof.best}</div>
    </div>
    ${expl('Les points notent la <b>méthode</b>, pas la chance : acheter dans la bonne zone du cycle et fractionner. On peut gagner de l’argent avec une mauvaise note, et l’inverse.')}

    ${missionBar()}

    <h2>Prix de revient</h2>
    <div class="kv"><span>Prix moyen d’achat sur ${buys.length} palier${buys.length>1?'s':''}</span>
      <b>${pru!=null?fmt2(pru):'—'}</b></div>
    <div class="kv"><span>Zone du prix moyen dans le cycle</span>
      <b>${zPru!=null?Math.round(clamp(zPru,0,1.4)*100)+' %':'—'} ${zPru!=null?'<span class="tag '+gradeBuy(zPru).k+'">'+gradeBuy(zPru).t+'</span>':''}</b></div>
    <div class="kv"><span>Creux réel du cycle</span><b>${fmt2(sc.pTr)} · ${dateFr(ser.dates[sc.tr])}</b></div>
    <div class="kv"><span>Sommet précédent / suivant</span><b>${fmt2(sc.pPk0)} → ${fmt2(sc.pPk1)}</b></div>
    ${expl(`Le creux exact n’était atteignable qu’une seule semaine sur ${sc.end-sc.start}. C’est pour ça qu’on joue la zone, pas le point.`)}

    <h2>Décision par décision</h2>${G.actions.map(ligne).join('')}

    <h2>Comportement</h2>
    ${bonus.length? bonus.map(b=>`<div class="kv"><span>${b[1]}</span><b style="color:${b[0][0]==='+'?'#5fe8b6':'#ff9098'}">${b[0]}</b></div>`).join('')
      : '<p class="note">Aucun bonus ni malus de comportement.</p>'}

    <h2>Contexte au moment de tes achats</h2>${infos}

    <h2>Comparaison</h2>
    <div class="kv"><span>Ton résultat</span><b>${dollars(valeur)}</b></div>
    <div class="kv"><span>Si tu avais tout mis dès la 1ʳᵉ manche</span><b>${dollars(bh)}</b></div>
    ${expl('Sur un seul cycle, le tout-d’un-coup peut battre les paliers. Sur vingt cycles, il te sort du marché une fois sur deux.')}

    <h2>Progression</h2>
    <div class="kv"><span>XP gagnés</span><b style="color:var(--gold2)">+${xpGain}</b></div>
    <div class="kv"><span>Décisions bien jouées</span><b>${bons} / ${G.actions.length}</b></div>
    <div class="kv"><span>Niveau</span><b>${G.prof.level}</b></div>
    ${expl('Les XP tiennent compte de la difficulté de l’actif : un cycle crypto rapporte plus qu’un indice, parce qu’il est bien plus dur à lire.')}

    <button class="btn" id="b-again">REJOUER</button>
    <button class="btn ghost" id="b-seechart">VOIR LE GRAPHIQUE COMPLET</button>
    <button class="btn ghost" id="b-prof">CLASSEMENT ET PROGRESSION</button>`;
  brancherBilan(sc);
}
