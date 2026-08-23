/* ============================================================
   TEMPS RÉEL
   Petit client du protocole Phoenix utilisé par Supabase Realtime.
   Aucune dépendance : une WebSocket, un battement de cœur, et de
   quoi suivre la présence et diffuser des messages sur un canal.
   ============================================================ */
const TempsReel = (() => {
  const URL = SB_URL.replace('https://','wss://') + '/realtime/v1/websocket?apikey='
            + SB_KEY + '&vsn=1.0.0';
  let ws = null, ref = 0, coeur = null, canaux = new Map();
  let etat = 'ferme';                    // ferme · connexion · ouvert
  let file = [], tentatives = 0;
  const auditeurs = new Set();           // prévenus des changements d'état

  const prevenir = () => auditeurs.forEach(f=>{ try{ f(etat); }catch(e){} });

  function envoyerBrut(msg){
    if(etat==='ouvert' && ws && ws.readyState===1) ws.send(JSON.stringify(msg));
    else file.push(msg);
  }
  const pousser = (topic,event,payload) =>
    envoyerBrut({topic, event, payload, ref:String(++ref)});

  function connecter(){
    if(etat!=='ferme') return;
    etat='connexion'; prevenir();
    try{ ws = new WebSocket(URL); }
    catch(e){ etat='ferme'; prevenir(); return replanifier(); }

    ws.onopen = ()=>{
      etat='ouvert'; tentatives=0; prevenir();
      coeur = setInterval(()=>pousser('phoenix','heartbeat',{}), 25000);
      canaux.forEach(c=>rejoindreCanal(c));         // on refait les join
      const attente = file; file = [];
      attente.forEach(envoyerBrut);
    };
    ws.onmessage = e=>{
      let m; try{ m = JSON.parse(e.data); }catch(err){ return; }
      const c = canaux.get(m.topic); if(!c) return;
      if(m.event==='presence_state'){ c.presences = m.payload || {}; c.majPresence(); }
      else if(m.event==='presence_diff'){
        for(const k in (m.payload.leaves||{})) delete c.presences[k];
        for(const k in (m.payload.joins||{})) c.presences[k] = m.payload.joins[k];
        c.majPresence();
      }
      else if(m.event==='broadcast'){
        const p = m.payload||{};
        (c.surMessage||function(){})(p.event, p.payload||{});
      }
    };
    ws.onclose = ()=>{ nettoyer(); replanifier(); };
    ws.onerror = ()=>{ try{ ws.close(); }catch(e){} };
  }
  function nettoyer(){
    clearInterval(coeur); coeur=null; etat='ferme'; prevenir();
    canaux.forEach(c=>{ c.joint=false; });
  }
  function replanifier(){
    tentatives = Math.min(tentatives+1, 6);
    setTimeout(connecter, 500*Math.pow(2, tentatives-1));   // 0,5 s puis doublement
  }

  function rejoindreCanal(c){
    pousser(c.topic,'phx_join',{config:{broadcast:{self:true, ack:false},
                                        presence:{key:c.cle}}});
    c.joint = true;
    if(c.meta) pousser(c.topic,'presence',{type:'presence', event:'track', payload:c.meta});
  }

  /* rejoint un canal ; renvoie l'objet pour dialoguer avec */
  function canal(nom, {cle='', meta=null, surMessage=null, surPresence=null}={}){
    const topic = 'realtime:'+nom;
    if(canaux.has(topic)) quitter(nom);
    const c = {
      topic, cle, meta, surMessage, presences:{}, joint:false,
      majPresence(){
        const liste = Object.entries(this.presences).map(([k,v])=>{
          const m = (v.metas && v.metas[0]) || {};
          return Object.assign({cle:k}, m);
        });
        (surPresence||function(){})(liste);
      },
      envoyer(event, payload){ pousser(topic,'broadcast',{type:'broadcast', event, payload}); },
      suivre(nouveau){ this.meta = nouveau;
        pousser(topic,'presence',{type:'presence', event:'track', payload:nouveau}); },
      quitter(){ quitter(nom); }
    };
    canaux.set(topic, c);
    if(etat==='ouvert') rejoindreCanal(c); else connecter();
    return c;
  }
  function quitter(nom){
    const topic = 'realtime:'+nom, c = canaux.get(topic);
    if(!c) return;
    if(etat==='ouvert') pousser(topic,'phx_leave',{});
    canaux.delete(topic);
  }

  return {
    canal, quitter, connecter,
    etat: ()=>etat,
    surEtat(f){ auditeurs.add(f); f(etat); return ()=>auditeurs.delete(f); }
  };
})();
