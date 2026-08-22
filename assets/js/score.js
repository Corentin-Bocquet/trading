/* ============================================================
   SCORING : toujours par ZONE de cycle, jamais en binaire
   Achat : position du prix entre le creux du cycle et le sommet précédent
   Vente : position du prix entre le creux et le sommet suivant
   ============================================================ */
function zoneBuy(p){  const s=G.sc; return (p - s.pTr)/(s.pPk0 - s.pTr); }
function zoneSell(p){ const s=G.sc; return (p - s.pTr)/(s.pPk1 - s.pTr); }

function gradeBuy(z){
  if(z<=0.20) return {k:'exc',pts:3, t:'ZONE BASSE',    d:'Les 20 % les plus bas du creux. C’est exactement là qu’on veut poser des paliers.'};
  if(z<=0.50) return {k:'cor',pts:1, t:'MOITIÉ BASSE',            d:'Correct : sous la moitié de la zone de correction, sans chercher le point exact.'};
  if(z<=0.80) return {k:'tie',pts:0, t:'ZONE TIÈDE',              d:'Ni haut ni bas. Ni faute ni bon coup : le palier travaille peu.'};
  return          {k:'bad',pts:-2,t:'PROCHE DU SOMMET', d:'Tu achètes près du haut du cycle d’avant. C’est là que la douleur commence.'};
}
function gradeSell(z){
  if(z>=0.80) return {k:'exc',pts:3, t:'HAUT DE CYCLE',      d:'Prise de profits dans les 20 % hauts du cycle. Excellent.'};
  if(z>=0.50) return {k:'cor',pts:1, t:'MOITIÉ HAUTE',       d:'Correct : tu allèges dans la partie haute, sans viser le sommet exact.'};
  if(z>=0.20) return {k:'tie',pts:0, t:'MILIEU DE CYCLE',    d:'Vente neutre, ni prématurée ni opportune.'};
  return          {k:'bad',pts:-2,t:'VENTE EN CREUX',   d:'Vendre en bas de cycle : c’est la faute la plus coûteuse du jeu.'};
}
function gradeWait(z){
  if(z<=0.20 && G.cash > G.capital*0.5)
    return {k:'bad',pts:-1,t:'ATTENTE EN CREUX', d:'Tu attendais pile dans la meilleure zone avec du cash plein les poches.'};
  if(z>=0.80) return {k:'exc',pts:1,t:'PATIENCE OK', d:'Ne rien faire près du sommet précédent est une décision, et une bonne.'};
  return          {k:'tie',pts:0,t:'ATTENTE NEUTRE',    d:'Zone intermédiaire : attendre ne coûte ni ne rapporte.'};
}


function verdictGlobal(score){
  if(score>=12) return {k:'exc',t:'LECTURE DE CYCLE EXCELLENTE'};
  if(score>=5)  return {k:'cor',t:'LECTURE CORRECTE'};
  if(score>=0)  return {k:'tie',t:'LECTURE TIÈDE'};
  return {k:'bad',t:'LECTURE À CORRIGER'};
}
