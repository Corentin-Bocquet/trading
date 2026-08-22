/* ============================================================
   AUDIO : effets sonores réels (fichiers mp3 dans assets/sounds)
   Préchargés, clonés à chaque lecture pour autoriser les
   superpositions. Déverrouillage iOS au premier geste.
   ============================================================ */
const Audio_ = (() => {
  const FILES = {
    swipe:'swipe.mp3',     // confirmation du geste
    coin:'coin.mp3',       // palier posé
    zoom:'zoom.mp3',       // zoom / dézoom
    whoosh:'whoosh.mp3',   // transition entre manches
    win:'win.mp3',         // bonne décision
    fail:'fail.mp3',       // mauvaise décision
    levelup:'levelup.mp3', // montée de niveau
    sell:'sell.mp3',       // prise de profits
    click:'click.mp3'      // clic d'interface
  };
  const VOL = {swipe:.55, coin:.6, zoom:.35, whoosh:.4, win:.55, fail:.5, levelup:.6, sell:.5, click:.3};
  const base = (document.currentScript && document.currentScript.src.includes('/assets/js/'))
    ? 'assets/sounds/' : 'assets/sounds/';
  const pool = {}; let on = localStorage.getItem('cyc_sfx')!=='0', unlocked=false;

  for(const k in FILES){
    const a = new Audio(base+FILES[k]);
    a.preload='auto'; a.volume=VOL[k]||.5; pool[k]=a;
  }
  // iOS n'autorise le son qu'après une interaction : on déverrouille au 1er geste
  function unlock(){
    if(unlocked) return; unlocked=true;
    for(const k in pool){
      const a=pool[k]; const v=a.volume; a.volume=0;
      a.play().then(()=>{ a.pause(); a.currentTime=0; a.volume=v; }).catch(()=>{ a.volume=v; });
    }
  }
  ['pointerdown','touchstart','keydown'].forEach(ev=>
    window.addEventListener(ev, unlock, {once:true, passive:true}));

  function play(k){
    if(!on || !pool[k]) return;
    try{
      const src = pool[k];
      const a = src.cloneNode();
      a.volume = src.volume;
      const p = a.play();
      if(p && p.catch) p.catch(()=>{});
    }catch(e){}
  }
  return {
    play,
    toggle:()=>{ on=!on; localStorage.setItem('cyc_sfx', on?'1':'0'); if(on) unlock(); return on; },
    isOn:()=>on, wake:unlock
  };
})();
