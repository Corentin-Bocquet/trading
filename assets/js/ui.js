/* ============================================================
   SECTION GAMIFICATION / UI
   ============================================================ */
function athAt(i){ let m=0; for(let k=0;k<=i;k++) if(G.ser.ohlc[k][1]>m) m=G.ser.ohlc[k][1]; return m; }

/* --- barre de progression "missions" : reproduction du visuel fourni --- */
function missionBar(){
  const done = missionDone(), reste = MISSIONS_PAR_NIVEAU-done;
  const p = done/MISSIONS_PAR_NIVEAU;
  let dots='';
  for(let k=0;k<reste;k++) dots += '<s class="'+(k===0?'hot':'')+'"></s>';
  return `<div class="missionwrap"><div class="missioncard">
    <div class="mtop">
      <div class="mico"><i></i></div>
      <div class="mtxt"><b>Bien joué&nbsp;!</b> Encore ${reste} mission${reste>1?'s':''} pour passer au niveau ${G.prof.level+1}.</div>
    </div>
    <div class="mtrack">
      <div class="mfill" style="width:${clamp(p*100,9,100)}%"></div>
      <div class="mdots" style="left:calc(${clamp(p*100,9,100)}% + 16px);right:16px;justify-content:space-around">${dots}</div>
    </div>
    <div class="mfoot"><span>${done} mission${done>1?'s':''} accomplie${done>1?'s':''}</span>
      <span>${reste} mission${reste>1?'s':''} restante${reste>1?'s':''}</span></div>
  </div></div>`;
}

/* --- classement empilé : reproduction du visuel fourni --- */
const SPARK='<svg width="13" height="13" viewBox="0 0 24 24" style="flex:0 0 auto"><path d="M12 0c.6 6.2 5.2 10.8 12 12-6.8 1.2-11.4 5.8-12 12-.6-6.2-5.2-10.8-12-12C6.8 10.8 11.4 6.2 12 0z" fill="currentColor"/></svg>';
const AVCOL=['#e0648a','#5b8def','#3fbf8f','#8b5cf6','#f59e0b','#ef4444'];
function avatar(nom){
  let h=0; for(const c of nom) h=(h*31+c.charCodeAt(0))|0;
  const col=AVCOL[Math.abs(h)%AVCOL.length];
  return `<div class="av" style="background:linear-gradient(150deg,${col},${col}99)">${nom[0].toUpperCase()}</div>`;
}
function leaderboard(list, rang, demo, moi){
  const rows = list.slice(0,5).map((u,i)=>`
    <div class="lbrow r${i+1}${moi && u.pseudo===moi.pseudo && u.xp===moi.xp ? ' me':''}">
      <div class="rk">${i+1}</div>${avatar(u.pseudo)}
      <div class="nm">${u.pseudo}</div>
      <div class="pt">+${fmt(u.xp)} XP ${SPARK}</div>
    </div>`).join('');
  const rank = rang==null?'':`<div class="lbme">TON RANG : ${rang>0?'#'+rang:'non classé'} · ${fmt(G.prof.xp)} XP</div>`;
  const dem = demo?'<p class="note" style="text-align:center;margin-top:8px">Classement de démonstration : crée un compte pour être classé face aux vrais joueurs.</p>':'';
  return `<div class="lbwrap"><div class="lbstack">${rows}</div></div>${rank}${dem}`;
}

/* --- animation de montée de niveau --- */
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

/* --- courbe de calibration : progression des scores dans le temps --- */
function calibCanvas(){
  setTimeout(()=>{
    const c=document.getElementById('calib'); if(!c) return;
    const dpr=Math.min(devicePixelRatio||1,2.5), r=c.getBoundingClientRect();
    c.width=r.width*dpr; c.height=r.height*dpr;
    const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
    const H=r.height,W=r.width, d=G.hist.slice(-24);
    x.clearRect(0,0,W,H);
    if(d.length<1){ x.fillStyle='#5b626e'; x.font='12px sans-serif'; x.textAlign='center';
      x.fillText('Joue quelques parties pour voir ta courbe', W/2, H/2); return; }
    const lo=Math.min(-6,...d.map(v=>v.score)), hi=Math.max(14,...d.map(v=>v.score));
    const px=i=> d.length===1? W/2 : 14+i*(W-28)/(d.length-1);
    const py=v=> H-16-((v-lo)/(hi-lo))*(H-30);
    x.strokeStyle='#242832'; x.lineWidth=1;
    [0].forEach(v=>{ const y=py(v)+.5; x.beginPath(); x.moveTo(0,y); x.lineTo(W,y); x.stroke(); });
    x.strokeStyle='#f5a524'; x.lineWidth=2; x.beginPath();
    d.forEach((v,i)=> i? x.lineTo(px(i),py(v.score)) : x.moveTo(px(i),py(v.score)));
    x.stroke();
    d.forEach((v,i)=>{ x.fillStyle = v.score>=12?'#16c784':v.score>=5?'#f5a524':v.score>=0?'#868d9a':'#ea3943';
      x.beginPath(); x.arc(px(i),py(v.score),3.4,0,7); x.fill(); });
  },30);
}

/* --- bilan du mode SIMPLE : pictogrammes, un actif, deux dates, un chiffre --- */
function renderResultSimple(R){
  const {sc,ser,last,buys,pru,zPru,score,valeur,xpGain}=R;
  const n = score>=12?5 : score>=8?4 : score>=5?3 : score>=0?2 : 1;
  const pastilles = Array.from({length:5},(_,i)=>`<s class="${i<n?'on':''}"></s>`).join('');
  const mult = valeur/CAPITAL_INIT;
  const sousSommet = pru!=null ? Math.max(0, Math.round((1-pru/sc.pPk0)*100)) : null;
  const an = i => ser.dates[i].slice(0,4);

  $('#res-body').innerHTML = `
  <div class="sres">
    <div class="pastilles">${pastilles}</div>
    <div class="asset">${ser.nom}</div>
    <div class="years">${an(sc.decs[0])} → ${an(sc.end)}<span style="opacity:.45"> · creux ${an(sc.tr)}</span></div>
    <div class="mult" style="color:${mult>=1?'#5fe8b6':'#ff9098'}">×${mult.toFixed(2).replace('.',',')}</div>
    <div class="xp">+${xpGain} XP</div>
    <div class="mini">
      <div><u>🪙</u><b>${buys.length}</b></div>
      ${sousSommet!=null?`<div><u>📉</u><b>−${sousSommet}%</b></div>`:''}
    </div>
    <div style="width:100%;margin-top:24px">${missionBar()}</div>
    <button class="bigbtn" id="b-again">▶</button>
    <div class="row2">
      <button class="roundbtn" id="b-seechart">📈</button>
      <button class="roundbtn" id="b-prof">🏆</button>
    </div>
  </div>`;
  brancherBilan(sc);
}

function brancherBilan(sc){
  $('#b-again').onclick    = ()=>{ Audio_.play('click'); startSession(); };
  $('#b-seechart').onclick = ()=>{ Audio_.play('click'); G.view.span = sc.end-sc.start+1;
    G.endVisible = sc.end; show('s-game'); Chart.resize(); Chart.draw(); };
  $('#b-prof').onclick     = ()=>{ Audio_.play('click'); go('profil.html'); };
}

/* --- écran de bilan --- */
function renderResult(R){
  if(G.mode==='simple') return renderResultSimple(R);
  const {sc,ser,last,buys,sells,pru,zPru,score,bonus,valeur,bh,xpGain,bons}=R;
  const v = verdictGlobal(score);
  const d0 = ser.dates[sc.decs[0]], d1 = ser.dates[sc.end];
  const isBTC = sc.a==='BTC';

  const ligne = a => {
    const lbl = a.type==='buy'?'Palier '+Math.round(a.pct*100)+'%'
             : a.type==='sell'?'Profits '+Math.round(a.pct*100)+'%' : 'Attente';
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
      <b style="font-size:11.5px;text-align:right">−${(dd*100).toFixed(0)}% sous l’ATH${
        ma?` · ${a.price>=ma?'+':''}${((a.price/ma-1)*100).toFixed(0).replace("-","−")}% vs MM200`:''}${
        h&&h.joursDepuis!=null?` · J+${h.joursDepuis} après halving`:''}</b></div>`;
  }).join('') || '<p class="note">Aucun palier posé sur ce cycle.</p>';

  $('#res-body').innerHTML = `
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-size:10.5px;letter-spacing:.22em;color:var(--gold);font-weight:800">REVEAL</div>
      <h1 style="margin:8px 0 2px">${ser.nom}</h1>
      <div class="note" style="font-size:13px">${dateFr(d0)} → ${dateFr(d1)} · repli du cycle : −${sc.dd} %</div>
    </div>
    <div style="text-align:center;margin:20px 0">
      <span class="tag ${v.k}" style="font-size:12px;padding:7px 13px">${v.t}</span>
      <div class="num" style="font-size:44px;font-weight:800;margin-top:12px">${score>0?'+':''}${score}</div>
      <div class="note">points de zone · record : ${G.prof.best}</div>
    </div>

    ${missionBar()}

    <h2>Prix de revient</h2>
    <div class="kv"><span>PRU sur ${buys.length} palier${buys.length>1?'s':''}</span>
      <b>${pru!=null?fmt2(pru):'—'}</b></div>
    <div class="kv"><span>Zone du PRU dans le cycle</span>
      <b>${zPru!=null?Math.round(clamp(zPru,0,1.4)*100)+' %':'—'} ${zPru!=null?'<span class="tag '+gradeBuy(zPru).k+'">'+gradeBuy(zPru).t+'</span>':''}</b></div>
    <div class="kv"><span>Creux réel du cycle</span><b>${fmt2(sc.pTr)} · ${dateFr(ser.dates[sc.tr])}</b></div>
    <div class="kv"><span>Sommet précédent / suivant</span><b>${fmt2(sc.pPk0)} → ${fmt2(sc.pPk1)}</b></div>
    <p class="note" style="margin-top:10px">Le creux exact n’était atteignable qu’une seule semaine sur ${sc.end-sc.start}.
    C’est pour ça qu’on joue la zone, pas le point.</p>

    <h2>Décision par décision</h2>${G.actions.map(ligne).join('')}

    <h2>Comportement</h2>
    ${bonus.length? bonus.map(b=>`<div class="kv"><span>${b[1]}</span><b class="${b[0][0]==='+'?'':''}" style="color:${b[0][0]==='+'?'#5fe8b6':'#ff9098'}">${b[0]}</b></div>`).join('')
      : '<p class="note">Aucun bonus ni malus de comportement.</p>'}

    <h2>Contexte au moment de tes achats</h2>${infos}

    <h2>Performance (information, pas score)</h2>
    <div class="kv"><span>Capital final</span><b>${fmt(valeur)} €</b></div>
    <div class="kv"><span>Si tu avais tout mis dès la 1ʳᵉ manche</span><b>${fmt(bh)} €</b></div>
    <p class="note" style="margin-top:10px">Sur un seul cycle, le tout-d’un-coup peut battre les paliers.
    Sur 20 cycles, il te sort du marché une fois sur deux. Le score note la méthode, pas la chance.</p>

    <h2>Progression</h2>
    <div class="kv"><span>XP gagnés</span><b style="color:var(--gold2)">+${xpGain}</b></div>
    <div class="kv"><span>Manches bien jouées</span><b>${bons} / ${G.actions.length}</b></div>
    <div class="kv"><span>Niveau</span><b>${G.prof.level}</b></div>

    <button class="btn" id="b-again">Nouveau cycle</button>
    <button class="btn ghost" id="b-seechart">Revoir le cycle complet</button>
    <button class="btn ghost" id="b-prof">Classement &amp; progression</button>`;

  brancherBilan(sc);
}
