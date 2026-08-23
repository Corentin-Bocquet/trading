/* ============================================================
   LES RÈGLES PURES DES JEUX DE CARTES
   Valeur d'une main, comparaison, meilleure combinaison. Aucun
   affichage, aucun état : partagé par le solo et par les tables
   en ligne.
   ============================================================ */

/* ---------- blackjack : l'as vaut 11 tant que ça ne dépasse pas ---------- */
function pointsBJ(cartes){
  let t=0, as=0;
  for(const c of cartes){
    if(c.v==='A'){ as++; t+=11; }
    else if(['J','Q','K','10'].includes(c.v)) t+=10;
    else t+=+c.v;
  }
  while(t>21 && as>0){ t-=10; as--; }
  return {total:t, souple: as>0};
}
const estBJ = m => m.length===2 && pointsBJ(m).total===21;

/* ---------- poker : valeur d'une main de 5 cartes ---------- */
const ORDRE = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const NOM_MAIN = ['Carte haute','Paire','Double paire','Brelan','Quinte','Couleur',
                  'Full','Carré','Quinte flush'];

function classe5(cartes){
  const v = cartes.map(c=>ORDRE[c.v]).sort((a,b)=>b-a);
  const couleur = cartes.every(c=>c.co===cartes[0].co);
  const cpt = {}; v.forEach(x=>cpt[x]=(cpt[x]||0)+1);
  const groupes = Object.entries(cpt).map(([x,n])=>[n,+x])
    .sort((a,b)=> b[0]-a[0] || b[1]-a[1]);
  // quinte, en tenant compte de l'as bas (A 2 3 4 5)
  const uniq = [...new Set(v)];
  let suite = 0;
  if(uniq.length===5){
    if(uniq[0]-uniq[4]===4) suite = uniq[0];
    else if(uniq[0]===14 && uniq[1]===5 && uniq[4]===2) suite = 5;
  }
  if(couleur && suite) return [8, suite];
  if(groupes[0][0]===4) return [7, groupes[0][1], groupes[1][1]];
  if(groupes[0][0]===3 && groupes[1][0]===2) return [6, groupes[0][1], groupes[1][1]];
  if(couleur) return [5, ...v];
  if(suite) return [4, suite];
  if(groupes[0][0]===3) return [3, groupes[0][1], ...groupes.slice(1).map(g=>g[1])];
  if(groupes[0][0]===2 && groupes[1][0]===2) return [2, groupes[0][1], groupes[1][1], groupes[2][1]];
  if(groupes[0][0]===2) return [1, groupes[0][1], ...groupes.slice(1).map(g=>g[1])];
  return [0, ...v];
}
function compare(a,b){ for(let i=0;i<Math.max(a.length,b.length);i++){
  const d=(a[i]||0)-(b[i]||0); if(d) return d; } return 0; }

/* meilleure main parmi 7 cartes : on essaie les 21 combinaisons */
function meilleure7(cartes){
  let best=null;
  for(let a=0;a<cartes.length-4;a++)
   for(let b=a+1;b<cartes.length-3;b++)
    for(let c=b+1;c<cartes.length-2;c++)
     for(let d=c+1;d<cartes.length-1;d++)
      for(let e=d+1;e<cartes.length;e++){
        const r=classe5([cartes[a],cartes[b],cartes[c],cartes[d],cartes[e]]);
        if(!best || compare(r,best)>0) best=r;
      }
  return best;
}
