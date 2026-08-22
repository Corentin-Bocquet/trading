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
    G.token = j.access_token; G.user = j.user; G.guest = false;
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
    G.prof = {pseudo:p.pseudo, level:p.level, xp:p.xp, best:+p.best_score,
              missions:p.rounds_played, rounds:p.rounds_played, sessions:p.sessions_played};
    // l'historique des scores sert à la courbe de calibration
    const s = await api('/rest/v1/cyc_sessions?user_id=eq.'+uid+'&select=*&order=created_at.asc&limit=60');
    G.hist = (s||[]).map(x=>({t:new Date(x.created_at).getTime(), id:x.scenario_id, a:x.asset,
      score:+x.score, bons:0, xp:x.xp_gained, n:x.paliers}));
    saveLocal();
  }

  async function saveSession(rec, detail){
    saveLocal();
    if(G.guest || !G.token) return;
    try{
      await api('/rest/v1/cyc_profiles?id=eq.'+G.user.id, {method:'PATCH',
        body:JSON.stringify({level:G.prof.level, xp:G.prof.xp, best_score:Math.round(G.prof.best),
          rounds_played:G.prof.missions, sessions_played:G.prof.sessions, updated_at:new Date().toISOString()})});
      await api('/rest/v1/cyc_sessions', {method:'POST', body:JSON.stringify({
        user_id:G.user.id, scenario_id:rec.id, asset:rec.a, score:Math.round(rec.score),
        grade:verdictGlobal(rec.score).k, avg_zone:rec.zPru!=null?Number(rec.zPru.toFixed(4)):null,
        paliers:detail.buys, xp_gained:rec.xp, detail:detail})});
    }catch(e){ console.warn('sync', e.message); }
  }

  const DEMO = [{pseudo:'Anna',xp:12400,level:9},{pseudo:'Sam',xp:8600,level:7},
                {pseudo:'Nariman',xp:5100,level:5},{pseudo:'Caleb',xp:2450,level:3},
                {pseudo:'Iris',xp:1200,level:2}];
  async function leaderboard(){
    if(!G.guest && G.token){
      try{
        const rows = await api('/rest/v1/cyc_profiles?select=pseudo,level,xp&order=xp.desc&limit=20', {});
        if(rows && rows.length){
          // rang calculé côté serveur : robuste même si deux joueurs ont le même pseudo
          let rank = 0;
          try{
            const r = await fetch(SB_URL+'/rest/v1/cyc_profiles?select=id&xp=gt.'+G.prof.xp,
              {method:'HEAD', headers:{...H(), 'Prefer':'count=exact'}});
            const cr = r.headers.get('content-range');            // format "*/12"
            if(cr) rank = parseInt(cr.split('/')[1],10) + 1;
          }catch(e){}
          return {list:rows, rank, moi:{pseudo:G.prof.pseudo, xp:G.prof.xp}};
        }
      }catch(e){ console.warn('lb', e.message); }
    }
    const moi = {pseudo:G.prof.pseudo, xp:G.prof.xp, level:G.prof.level};
    const list = [...DEMO, moi].sort((a,b)=>b.xp-a.xp);
    return {list, rank:list.indexOf(moi)+1, demo:true, moi};
  }

  async function restore(){
    const t = localStorage.getItem('cyc_tok'); if(!t) return false;
    G.token = t;
    try{
      const r = await fetch(SB_URL+'/auth/v1/user', {headers:{'apikey':SB_KEY,'Authorization':'Bearer '+t}});
      if(!r.ok) throw 0;
      G.user = await r.json(); G.guest=false; await loadProfile(); return true;
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

  return {
    ping,
    signup: async (m,p,ps)=>{ const j=await auth('signup',{email:m,password:p,data:{pseudo:ps}});
      if(!j.access_token && j.id){ const k=await auth('token?grant_type=password',{email:m,password:p});
        return afterAuth(k,ps); } return afterAuth(j,ps); },
    login:  async (m,p,ps)=> afterAuth(await auth('token?grant_type=password',{email:m,password:p}), ps),
    saveSession, leaderboard, restore, loadProfile
  };
})();

