/* ============================================================
   SECTION SUPABASE : auth + sauvegarde serveur de la progression
   Projet créé et provisionné via le connecteur Composio
   (tables cyc_profiles / cyc_sessions + RLS).
   Appels REST natifs : aucune dépendance externe à charger.
   ============================================================ */
const SB_URL = 'https://nrhkijgxbxslczutjrev.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaGtpamd4YnhzbGN6dXRqcmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzIyMjQsImV4cCI6MjEwMjY0ODIyNH0.p6G0IwbQUzEK_jT4YffNVj0uHkxkT5jbtLoiFnHJc6E';

const Cloud = (() => {
  const H = (auth=true) => {
    const h = {'apikey':SB_KEY,'Content-Type':'application/json'};
    h['Authorization'] = 'Bearer ' + (auth && G.token ? G.token : SB_KEY);
    return h;
  };
  async function api(path, opt={}){
    const r = await fetch(SB_URL+path, {...opt, headers:{...H(), ...(opt.headers||{})}});
    const txt = await r.text();
    let j=null; try{ j = txt? JSON.parse(txt):null; }catch(e){}
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

  async function loadProfile(pseudo){
    const uid = G.user.id;
    let rows = await api('/rest/v1/cyc_profiles?id=eq.'+uid+'&select=*');
    if(!rows || !rows.length){
      rows = await api('/rest/v1/cyc_profiles', {method:'POST',
        headers:{'Prefer':'return=representation'},
        body:JSON.stringify({id:uid, pseudo:pseudo||('Joueur'+uid.slice(0,4))})});
    }
    const p = rows[0];
    G.prof = {pseudo:p.pseudo, avatar:p.avatar||null, level:p.level, xp:p.xp, best:+p.best_score,
              missions:p.rounds_played,                 // décisions bien jouées (pilote les niveaux)
              rounds:p.total_calls || 0,                // décisions au total (0 = pas encore mesuré)
              sessions:p.sessions_played,
              cash:p.cash!=null ? +p.cash : CAPITAL_DEPART,
              ruines:p.ruines||0,
              cashRl:p.cash_rl!=null ? +p.cash_rl : RL_DEPART,
              ruinesRl:p.ruines_rl||0, toursRl:p.tours_rl||0,
              spins:decodeSpins(p.spins), streak:p.streak||0, jour:p.dernier_jour||null};
    // l'historique des scores sert à la courbe de calibration
    const s = await api('/rest/v1/cyc_sessions?user_id=eq.'+uid+'&select=*&order=created_at.asc&limit=60');
    let prec = CAPITAL_DEPART;
    G.hist = (s||[]).map(x=>{
      const cash = x.cash_after!=null ? +x.cash_after : null;
      const gain = cash!=null ? cash-prec : 0;
      if(cash!=null) prec = cash;
      return {t:new Date(x.created_at).getTime(), id:x.scenario_id, a:x.asset,
        score:+x.score, bons:0, xp:x.xp_gained, n:x.paliers, cash, gain};
    });
    saveLocal();
  }

  async function saveSession(rec, detail){
    saveLocal();
    if(!G.token || G.sbUp===false) return;
    try{
      await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH',
        body:JSON.stringify({level:G.prof.level, xp:G.prof.xp, best_score:Math.round(G.prof.best),
          rounds_played:G.prof.missions, total_calls:G.prof.rounds,
          sessions_played:G.prof.sessions, cash:Math.round(G.prof.cash), ruines:G.prof.ruines,
          streak:G.prof.streak||0, dernier_jour:G.prof.jour,
          updated_at:new Date().toISOString()})});
      await api('/rest/v1/cyc_sessions', {method:'POST', body:JSON.stringify({
        user_id:G.user.id, scenario_id:rec.id, asset:rec.a, score:Math.round(rec.score),
        grade:verdictGlobal(rec.score).k, avg_zone:rec.zPru!=null?Number(rec.zPru.toFixed(4)):null,
        paliers:detail.buys, xp_gained:rec.xp, cash_after:Math.round(rec.cash),
        marche:NOM_MARCHE(G.marche), detail:detail})});
    }catch(e){ console.warn('sync', e.message); }
  }

  // sauvegarde de la roulette : caisse, ruines, tours et suite des numéros
  let fileRl = null;
  async function saveRoulette(){
    saveLocal();
    if(!G.token || G.sbUp===false) return;
    clearTimeout(fileRl);
    fileRl = setTimeout(async ()=>{     // on regroupe les envois : un tour dure 6 s
      try{
        if(!G.user) await restore();
        await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH',
          body:JSON.stringify({cash_rl:Math.round(G.prof.cashRl), ruines_rl:G.prof.ruinesRl,
            tours_rl:G.prof.toursRl, spins:encodeSpins(G.prof.spins||[]),
            streak:G.prof.streak||0, dernier_jour:G.prof.jour,
            updated_at:new Date().toISOString()})});
      }catch(e){ console.warn('roulette', e.message); }
    }, 900);
  }

  // historique public d'un autre joueur, pour la fiche du classement
  async function sessionsDe(pseudo){
    try{
      const rows = await api('/rest/v1/cyc_profiles?select=id&pseudo=eq.'+encodeURIComponent(pseudo)+'&limit=1');
      if(!rows||!rows.length) return [];
      const s = await api('/rest/v1/cyc_sessions?user_id=eq.'+rows[0].id
        +'&select=created_at,asset,score,xp_gained,cash_after&order=created_at.asc&limit=60');
      let prec = CAPITAL_DEPART;
      return (s||[]).map(x=>{ const cash=x.cash_after!=null?+x.cash_after:null;
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
  async function leaderboard(){
    if(G.token && G.sbUp!==false){
      try{
        const rows = await api('/rest/v1/cyc_profiles?select=pseudo,level,xp,avatar,rounds_played,total_calls,cash,ruines,cash_rl,ruines_rl,tours_rl,streak&order=cash.desc&limit=40', {});
        (rows||[]).forEach(r=>{ r.missions=r.rounds_played; r.rounds=r.total_calls||0;
          r.cash = r.cash!=null ? +r.cash : CAPITAL_DEPART; r.ruines = r.ruines||0;
          r.cashRl = r.cash_rl!=null ? +r.cash_rl : RL_DEPART;
          r.ruinesRl = r.ruines_rl||0; r.toursRl = r.tours_rl||0; r.streak = r.streak||0; });
        if(rows && rows.length){
          return {list:rows, rank:0, moi:{pseudo:G.prof.pseudo, xp:G.prof.xp,
                  cash:G.prof.cash, ruines:G.prof.ruines,
                  missions:G.prof.missions, rounds:G.prof.rounds}};
        }
      }catch(e){ console.warn('lb', e.message); }
    }
    const moi = {pseudo:G.prof.pseudo, xp:G.prof.xp, level:G.prof.level, avatar:G.prof.avatar,
                 missions:G.prof.missions, rounds:G.prof.rounds,
                 cash:G.prof.cash, ruines:G.prof.ruines, cashRl:G.prof.cashRl,
                 ruinesRl:G.prof.ruinesRl, toursRl:G.prof.toursRl, streak:G.prof.streak};
    const list = [...DEMO, moi].sort((a,b)=>b.xp-a.xp);
    return {list, rank:list.indexOf(moi)+1, demo:true, moi};
  }

  async function restore(){
    const t = localStorage.getItem('cyc_tok'); if(!t) return false;
    G.token = t;
    try{
      const r = await fetch(SB_URL+'/auth/v1/user', {headers:{'apikey':SB_KEY,'Authorization':'Bearer '+t}});
      if(!r.ok) throw 0;
      G.user = await r.json(); G.offline=false; await loadProfile(); return true;
    }catch(e){
      const rt = localStorage.getItem('cyc_ref');
      if(rt){ try{ const j = await auth('token?grant_type=refresh_token',{refresh_token:rt});
        await afterAuth(j); return true; }catch(e2){} }
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
    if(pseudo!=null) G.prof.pseudo = pseudo;
    if(avatar!==undefined) G.prof.avatar = avatar;
    saveLocal();
    if(!G.token || G.sbUp===false) return;
    const body = {updated_at:new Date().toISOString()};
    if(pseudo!=null) body.pseudo = pseudo;
    if(avatar!==undefined) body.avatar = avatar;
    await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH', body:JSON.stringify(body)});
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

  return {
    ping, saveProfil, savePush, removePush, saveRoulette, sessionsDe,
    signup: async (m,p,ps)=>{ const j=await auth('signup',{email:m,password:p,data:{pseudo:ps}});
      if(!j.access_token && j.id){ const k=await auth('token?grant_type=password',{email:m,password:p});
        return afterAuth(k,ps); } return afterAuth(j,ps); },
    login:  async (m,p,ps)=> afterAuth(await auth('token?grant_type=password',{email:m,password:p}), ps),
    saveSession, leaderboard, restore, loadProfile
  };
})();

