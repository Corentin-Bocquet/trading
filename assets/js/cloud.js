/* ============================================================
   SECTION SUPABASE : auth + sauvegarde serveur de la progression
   Projet créé et provisionné via le connecteur Composio
   (tables cyc_profiles / cyc_sessions + RLS).
   Appels REST natifs : aucune dépendance externe à charger.

   Synchronisation :
   - toute modification locale marque le profil « à envoyer »
     (cyc_sale = identifiant du compte) ;
   - l'envoi est regroupé (900 ms) et repart au premier chargement
     suivant s'il a échoué : le serveur ne remplace jamais une
     progression locale qui n'a pas encore été envoyée ;
   - en quittant la page, l'envoi en attente part tout de suite ;
   - le jeton de connexion expire au bout d'une heure : il est
     renouvelé automatiquement et la requête est rejouée.
   ============================================================ */
const SB_URL = 'https://nrhkijgxbxslczutjrev.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaGtpamd4YnhzbGN6dXRqcmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzIyMjQsImV4cCI6MjEwMjY0ODIyNH0.p6G0IwbQUzEK_jT4YffNVj0uHkxkT5jbtLoiFnHJc6E';

const Cloud = (() => {
  const H = (auth=true) => {
    const h = {'apikey':SB_KEY,'Content-Type':'application/json'};
    h['Authorization'] = 'Bearer ' + (auth && G.token ? G.token : SB_KEY);
    return h;
  };
  let renouvellement = null;
  async function renouveler(){
    const rt = localStorage.getItem('cyc_ref'); if(!rt) return false;
    if(!renouvellement) renouvellement = (async()=>{
      try{
        const j = await auth('token?grant_type=refresh_token', {refresh_token:rt});
        if(!j.access_token) return false;
        G.token = j.access_token; if(j.user) G.user = j.user;
        localStorage.setItem('cyc_tok', j.access_token);
        if(j.refresh_token) localStorage.setItem('cyc_ref', j.refresh_token);
        return true;
      }catch(e){ return false; }
      finally{ setTimeout(()=>{ renouvellement = null; }, 0); }
    })();
    return renouvellement;
  }
  async function api(path, opt={}, rejeu=true){
    const r = await fetch(SB_URL+path, {...opt, headers:{...H(), ...(opt.headers||{})}});
    const txt = await r.text();
    let j=null; try{ j = txt? JSON.parse(txt):null; }catch(e){}
    if(r.status===401 && rejeu && G.token && await renouveler()) return api(path, opt, false);
    if(!r.ok) throw new Error((j && (j.msg||j.message||j.error_description||j.error)) || ('HTTP '+r.status));
    return j;
  }
  async function auth(path, body){
    const r = await fetch(SB_URL+'/auth/v1/'+path, {method:'POST',
      headers:{'apikey':SB_KEY,'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const j = await r.json();
    if(!r.ok) throw new Error(j.msg||j.error_description||j.message||('HTTP '+r.status));
    return j;
  }

  async function afterAuth(j, pseudo){
    if(!j.access_token){ throw new Error('Compte créé. Confirme ton email puis connecte-toi.'); }
    G.token = j.access_token; G.user = j.user; G.offline = false;
    localStorage.setItem('cyc_tok', j.access_token);
    localStorage.setItem('cyc_ref', j.refresh_token||'');
    await loadProfile(pseudo);
  }

  /* ---------- ce qui part au serveur : le profil complet ---------- */
  function corpsProfil(){
    const p = G.prof;
    return {level:p.level, xp:p.xp, best_score:Math.round(p.best||0),
      rounds_played:p.missions, total_calls:p.rounds, sessions_played:p.sessions,
      cash:Math.round(p.cash), ruines:p.ruines||0,
      cash_rl:Math.round(p.cashRl), ruines_rl:p.ruinesRl||0, tours_rl:p.toursRl||0,
      spins:encodeSpins(p.spins||[]),
      cash_bj:Math.round(p.cashBj), ruines_bj:p.ruinesBj||0, mains_bj:p.mainsBj||0,
      cash_pk:Math.round(p.cashPk), ruines_pk:p.ruinesPk||0, mains_pk:p.mainsPk||0,
      streak:p.streak||0, dernier_jour:p.jour, updated_at:new Date().toISOString()};
  }
  const uidLocal = () => localStorage.getItem('cyc_uid');
  const estSale  = uid => !!uid && localStorage.getItem('cyc_sale') === uid;

  async function loadProfile(pseudo){
    const uid = G.user.id;
    // la progression locale appartient-elle à ce compte ?
    const memeCompte = uidLocal() === uid;
    let rows = await api('/rest/v1/cyc_profiles?id=eq.'+uid+'&select=*');
    if(!rows || !rows.length){
      rows = await api('/rest/v1/cyc_profiles', {method:'POST',
        headers:{'Prefer':'return=representation'},
        body:JSON.stringify({id:uid, pseudo:pseudo||('Joueur'+uid.slice(0,4))})});
    }
    const p = rows[0];
    localStorage.setItem('cyc_uid', uid);
    // progression locale pas encore envoyée : c'est elle qui fait foi
    if(memeCompte && estSale(uid)){
      G.prof.pseudo = G.prof.pseudo || p.pseudo;
      saveLocal(); pousser();
    }else{
      G.prof = {pseudo:p.pseudo, avatar:photoSure(p.avatar), level:p.level||1, xp:p.xp||0, best:+p.best_score||0,
              missions:p.rounds_played||0,           // décisions bien jouées (pilote les niveaux)
              rounds:p.total_calls || 0,             // décisions au total (0 = pas encore mesuré)
              sessions:p.sessions_played||0,
              cash:p.cash!=null ? +p.cash : CAPITAL_DEPART,
              ruines:p.ruines||0,
              cashRl:p.cash_rl!=null ? +p.cash_rl : RL_DEPART,
              ruinesRl:p.ruines_rl||0, toursRl:p.tours_rl||0,
              spins:decodeSpins(p.spins), streak:p.streak||0, jour:p.dernier_jour||null,
              cashBj:p.cash_bj!=null?+p.cash_bj:BJ_DEPART, ruinesBj:p.ruines_bj||0, mainsBj:p.mains_bj||0,
              cashPk:p.cash_pk!=null?+p.cash_pk:PK_DEPART, ruinesPk:p.ruines_pk||0, mainsPk:p.mains_pk||0};
      if(!memeCompte){ try{ localStorage.removeItem('cyc_partie'); }catch(e){} }
    }
    await envoyerFile();
    // l'historique sert à la courbe : les 60 cycles les plus récents
    G.hist = await historique(uid);
    const file = lireFile();
    if(file.length) G.hist = G.hist.concat(file.map(f=>f.rec));
    saveLocal();
  }

  /* les 60 derniers cycles, dans l'ordre ; on lit un cycle de plus
     pour connaître le portefeuille de départ du premier affiché */
  async function historique(uid){
    const s = await api('/rest/v1/cyc_sessions?user_id=eq.'+uid
      +'&select=created_at,scenario_id,asset,score,xp_gained,paliers,cash_after,marche,detail&order=created_at.desc&limit=61');
    const rows = (s||[]).reverse();
    let prec = CAPITAL_DEPART;
    if(rows.length===61){ const b=rows.shift(); if(b.cash_after!=null) prec = +b.cash_after; }
    return rows.map(x=>{
      const cash = x.cash_after!=null ? +x.cash_after : null;
      const gain = cash!=null ? cash-prec : 0;
      if(cash!=null) prec = cash;
      const d = x.detail || {};
      return {t:new Date(x.created_at).getTime(), id:x.scenario_id, a:x.asset,
        score:+x.score, bons:0, xp:x.xp_gained, n:x.paliers, b:x.paliers, cash, gain,
        zb:d.zb||null, recul:d.recul||null, cat:d.cat||null,
        defi: /^DÉFI /.test(x.marche||'') ? x.marche.slice(5) : null};
    });
  }

  /* ---------- envoi du profil, regroupé ---------- */
  let minuterie = null, enCours = null;
  function marquer(){
    if(!G.user && !uidLocal()) return;
    localStorage.setItem('cyc_sale', (G.user && G.user.id) || uidLocal());
  }
  function pousser(){
    clearTimeout(minuterie);
    minuterie = setTimeout(envoyer, 900);
  }
  async function envoyer(){
    minuterie = null;
    if(!G.token || G.sbUp===false) return;
    if(enCours){ await enCours; }
    enCours = (async()=>{
      try{
        if(!G.user) await restore();
        if(!G.user) return;
        const version = localStorage.getItem('cyc_ver');
        await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH', body:JSON.stringify(corpsProfil())});
        // rien n'a bougé pendant l'envoi : le profil est à jour sur le serveur
        if(localStorage.getItem('cyc_ver') === version) localStorage.removeItem('cyc_sale');
      }catch(e){ console.warn('sync', e.message); }
    })();
    await enCours; enCours = null;
  }
  /* enregistre localement, marque à envoyer, envoie un peu plus tard */
  function sauver(){
    saveLocal();
    localStorage.setItem('cyc_ver', String(Date.now()) + Math.random());
    marquer(); pousser();
  }
  /* la page se ferme : l'envoi en attente part tout de suite */
  function envoiImmediat(){
    if(!G.token || !G.user || !estSale(G.user.id)) return;
    clearTimeout(minuterie); minuterie = null;
    try{
      fetch(SB_URL+'/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH', keepalive:true,
        headers:H(), body:JSON.stringify(corpsProfil())}).catch(()=>{});
    }catch(e){}
  }
  window.addEventListener('pagehide', envoiImmediat);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') envoiImmediat(); });
  window.addEventListener('online', ()=>{ G.sbUp = null; if(G.user && estSale(G.user.id)) pousser(); envoyerFile(); });

  /* ---------- cycles de trading pas encore enregistrés ---------- */
  const lireFile = () => { try{ const f = JSON.parse(localStorage.getItem('cyc_file')||'[]');
    return Array.isArray(f) ? f.filter(x=>x && x.uid===uidLocal()) : []; }catch(e){ return []; } };
  const ecrireFile = f => { try{ localStorage.setItem('cyc_file', JSON.stringify(f.slice(-40))); }catch(e){} };
  async function envoyerFile(){
    if(!G.token || !G.user) return;
    const file = lireFile(); if(!file.length) return;
    const reste = [];
    for(const x of file){
      try{ await api('/rest/v1/cyc_sessions', {method:'POST', body:JSON.stringify(x.ligne)}); }
      catch(e){ reste.push(x); }
    }
    ecrireFile(reste);
  }

  async function saveSession(rec, detail){
    sauver();
    const uid = (G.user && G.user.id) || uidLocal();
    if(!uid) return;
    const ligne = {user_id:uid, scenario_id:rec.id, asset:rec.a, score:Math.round(rec.score),
      grade:verdictGlobal(rec.score).k, avg_zone:rec.zPru!=null?Number(rec.zPru.toFixed(4)):null,
      paliers:detail.buys, xp_gained:rec.xp, cash_after:Math.round(rec.cash),
      marche: rec.defi ? marcheDefi(rec.defi) : NOM_MARCHE(G.marche), detail:detail};
    const file = lireFile(); file.push({uid, ligne, rec}); ecrireFile(file);
    if(G.token && G.sbUp!==false) envoyerFile();
  }

  // historique public d'un autre joueur, pour la fiche du classement
  async function sessionsDe(id){
    try{
      if(!id) return [];
      const s = await api('/rest/v1/cyc_sessions?user_id=eq.'+encodeURIComponent(id)
        +'&select=created_at,asset,score,xp_gained,cash_after&order=created_at.desc&limit=61');
      const rows = (s||[]).reverse();
      let prec = CAPITAL_DEPART;
      if(rows.length===61){ const b=rows.shift(); if(b.cash_after!=null) prec = +b.cash_after; }
      return rows.map(x=>{ const cash=x.cash_after!=null?+x.cash_after:null;
        const gain=cash!=null?cash-prec:0; if(cash!=null) prec=cash;
        return {t:new Date(x.created_at).getTime(), a:x.asset, score:+x.score,
                xp:x.xp_gained, cash, gain}; });
    }catch(e){ return []; }
  }

  const DEMO = [{pseudo:'Anna',xp:12400,level:9,missions:214,rounds:248,cash:31200,ruines:0,cashRl:118,ruinesRl:0,toursRl:210,streak:12},
                {pseudo:'Sam',xp:8600,level:7,missions:139,rounds:181,cash:18400,ruines:1,cashRl:12,ruinesRl:3,toursRl:640,streak:4},
                {pseudo:'Nariman',xp:5100,level:5,missions:78,rounds:112,cash:12750,ruines:0,cashRl:64,ruinesRl:1,toursRl:95,streak:7},
                {pseudo:'Caleb',xp:2450,level:3,missions:31,rounds:60,cash:6300,ruines:2,cashRl:31,ruinesRl:0,toursRl:40,streak:1},
                {pseudo:'Iris',xp:1200,level:2,missions:12,rounds:29,cash:9100,ruines:0,cashRl:50,ruinesRl:0,toursRl:0,streak:2}];
  /* le classement est trié côté serveur sur la colonne du jeu affiché :
     sinon les meilleurs joueurs de roulette n'apparaîtraient jamais s'ils
     ne sont pas aussi dans le haut du classement de trading */
  const TRI_JEU = {trading:'cash', roulette:'cash_rl', blackjack:'cash_bj', poker:'cash_pk'};
  function moiLb(){
    return {id:G.user&&G.user.id, pseudo:G.prof.pseudo, xp:G.prof.xp, level:G.prof.level, avatar:G.prof.avatar,
      missions:G.prof.missions, rounds:G.prof.rounds, cash:G.prof.cash, ruines:G.prof.ruines,
      cashRl:G.prof.cashRl, ruinesRl:G.prof.ruinesRl, toursRl:G.prof.toursRl, streak:G.prof.streak,
      cashBj:G.prof.cashBj, ruinesBj:G.prof.ruinesBj, mainsBj:G.prof.mainsBj,
      cashPk:G.prof.cashPk, ruinesPk:G.prof.ruinesPk, mainsPk:G.prof.mainsPk};
  }
  async function leaderboard(jeu){
    if(G.token && G.sbUp!==false){
      try{
        const col = TRI_JEU[jeu] || 'cash';
        const rows = await api('/rest/v1/cyc_profiles?select=id,pseudo,level,xp,avatar,rounds_played,total_calls,cash,ruines,cash_rl,ruines_rl,tours_rl,streak,cash_bj,ruines_bj,mains_bj,cash_pk,ruines_pk,mains_pk&order='+col+'.desc.nullslast&limit=50', {});
        (rows||[]).forEach(r=>{ r.missions=r.rounds_played||0; r.rounds=r.total_calls||0;
          r.avatar = photoSure(r.avatar); r.level = r.level||1; r.xp = r.xp||0;
          r.cash = r.cash!=null ? +r.cash : CAPITAL_DEPART; r.ruines = r.ruines||0;
          r.cashRl = r.cash_rl!=null ? +r.cash_rl : RL_DEPART;
          r.ruinesRl = r.ruines_rl||0; r.toursRl = r.tours_rl||0; r.streak = r.streak||0;
          r.cashBj = r.cash_bj!=null?+r.cash_bj:BJ_DEPART; r.ruinesBj=r.ruines_bj||0; r.mainsBj=r.mains_bj||0;
          r.cashPk = r.cash_pk!=null?+r.cash_pk:PK_DEPART; r.ruinesPk=r.ruines_pk||0; r.mainsPk=r.mains_pk||0; });
        if(rows && rows.length){
          // ma ligne reflète toujours mes chiffres du moment, même pas encore envoyés
          const moi = moiLb();
          const i = rows.findIndex(r=>r.id && r.id===moi.id);
          if(i>=0) rows[i] = Object.assign(rows[i], moi); else if(moi.id) rows.push(moi);
          return {list:rows, rank:0, moi};
        }
      }catch(e){ console.warn('lb', e.message); }
    }
    const moi = moiLb();
    const list = [...DEMO, moi].sort((a,b)=>b.xp-a.xp);
    return {list, rank:list.indexOf(moi)+1, demo:true, moi};
  }

  async function restore(){
    const t = localStorage.getItem('cyc_tok'); if(!t) return false;
    G.token = t;
    try{
      let r = await fetch(SB_URL+'/auth/v1/user', {headers:{'apikey':SB_KEY,'Authorization':'Bearer '+G.token}});
      if(r.status===401 && await renouveler())
        r = await fetch(SB_URL+'/auth/v1/user', {headers:{'apikey':SB_KEY,'Authorization':'Bearer '+G.token}});
      if(!r.ok){ const e = new Error('HTTP '+r.status); e.status = r.status; throw e; }
      G.user = await r.json(); G.offline=false; await loadProfile(); return true;
    }catch(e){
      // réseau coupé : on garde la session, la progression reste locale
      if(!e.status){ G.offline = true; G.user = G.user || (uidLocal() ? {id:uidLocal()} : null); return false; }
      // session vraiment expirée : retour à la connexion
      localStorage.removeItem('cyc_tok'); G.token=null; return false;
    }
  }

  // sonde de disponibilité du serveur (CSP stricte, hors ligne, coupure réseau)
  async function ping(){
    if(G.sbUp!=null) return G.sbUp;
    try{
      const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),2500);
      const r=await fetch(SB_URL+'/auth/v1/health',{headers:{apikey:SB_KEY},signal:ctl.signal});
      clearTimeout(to); G.sbUp = r.ok;
    }catch(e){ G.sbUp=false; }
    return G.sbUp;
  }

  // enregistre le pseudo et la photo de profil
  async function saveProfil({pseudo, avatar}){
    if(!G.user && G.token) await restore();
    if(!G.user) throw new Error('Session expirée, reconnecte-toi.');
    const body = {updated_at:new Date().toISOString()};
    if(pseudo!=null) body.pseudo = pseudo;
    if(avatar!==undefined) body.avatar = photoSure(avatar);
    if(G.token && G.sbUp!==false)
      await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH', body:JSON.stringify(body)});
    if(pseudo!=null) G.prof.pseudo = pseudo;
    if(avatar!==undefined) G.prof.avatar = photoSure(avatar);
    saveLocal();
  }

  // abonnement aux rappels quotidiens
  async function savePush(s){
    if(!G.user && G.token) await restore();
    if(!G.user) throw new Error('Session expirée, reconnecte-toi.');
    await api('/rest/v1/cyc_push', {method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({user_id:G.user.id, endpoint:s.endpoint,
        p256dh:s.p256dh, auth:s.auth, pseudo:G.prof.pseudo})});
  }
  async function removePush(endpoint){
    if(!G.user) return;
    await api('/rest/v1/cyc_push?endpoint=eq.'+encodeURIComponent(endpoint), {method:'DELETE'});
  }

  /* classement du défi d'un jour : un seul essai compté par joueur, le premier */
  async function classementDefi(jour){
    const moi = G.hist.slice().reverse().find(h=>h.defi===jour);
    const monRang = l => { const i = l.findIndex(x=>x.moi); return i>=0 ? i+1 : 0; };
    if(G.token && G.sbUp!==false){
      try{
        const s = await api('/rest/v1/cyc_sessions?marche=eq.'+encodeURIComponent(marcheDefi(jour))
          +'&select=user_id,score,created_at&order=created_at.asc&limit=500');
        const vus = new Map();
        (s||[]).forEach(x=>{ if(!vus.has(x.user_id)) vus.set(x.user_id, +x.score); });
        const ids = [...vus.keys()];
        let noms = {};
        if(ids.length){
          const p = await api('/rest/v1/cyc_profiles?select=id,pseudo,avatar&id=in.('+ids.map(encodeURIComponent).join(',')+')');
          (p||[]).forEach(x=>{ noms[x.id] = x; });
        }
        const uid = G.user && G.user.id;
        if(moi && uid && !vus.has(uid)) vus.set(uid, moi.score);
        const liste = [...vus.entries()].map(([id,score])=>({id, score,
          pseudo: id===uid ? G.prof.pseudo : ((noms[id]||{}).pseudo||'?'),
          avatar: id===uid ? G.prof.avatar : photoSure((noms[id]||{}).avatar), moi: id===uid}))
          .sort((a,b)=>b.score-a.score);
        return {liste, rang:monRang(liste), total:liste.length};
      }catch(e){ console.warn('defi', e.message); }
    }
    const liste = moi ? [{pseudo:G.prof.pseudo, avatar:G.prof.avatar, score:moi.score, moi:true}] : [];
    return {liste, rang:monRang(liste), total:liste.length, horsLigne:true};
  }

  async function oubli(mail, retour){
    const r = await fetch(SB_URL+'/auth/v1/recover?redirect_to='+encodeURIComponent(retour), {method:'POST',
      headers:{'apikey':SB_KEY,'Content-Type':'application/json'}, body:JSON.stringify({email:mail})});
    if(!r.ok){ let j={}; try{ j=await r.json(); }catch(e){} throw new Error(j.msg||j.message||('HTTP '+r.status)); }
  }
  async function nouveauMdp(jeton, refresh, mdp){
    const r = await fetch(SB_URL+'/auth/v1/user', {method:'PUT',
      headers:{'apikey':SB_KEY,'Content-Type':'application/json','Authorization':'Bearer '+jeton},
      body:JSON.stringify({password:mdp})});
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.msg||j.message||('HTTP '+r.status));
    await afterAuth({access_token:jeton, refresh_token:refresh, user:j});
  }

  return {
    oubli, nouveauMdp, classementDefi,
    ping, saveProfil, savePush, removePush, sessionsDe, sauver,
    // anciens noms, gardés pour les pages de jeu
    saveRoulette: sauver, saveJeu: sauver,
    enAttente: () => !!(G.user && estSale(G.user.id)) || lireFile().length>0,
    signup: async (m,p,ps)=>{ const j=await auth('signup',{email:m,password:p,data:{pseudo:ps}});
      if(!j.access_token && j.id){ const k=await auth('token?grant_type=password',{email:m,password:p});
        return afterAuth(k,ps); } return afterAuth(j,ps); },
    login:  async (m,p,ps)=> afterAuth(await auth('token?grant_type=password',{email:m,password:p}), ps),
    saveSession, leaderboard, restore, loadProfile
  };
})();
