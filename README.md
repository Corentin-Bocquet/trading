# Trading — entraîneur de cycles de marché

Application web (PWA) d'entraînement à la lecture des cycles boursiers.
Le principe : on ne tope jamais le point exact, on reconnaît une **zone**,
on **dézoome**, et on **fractionne** ses entrées et ses sorties par paliers.

## Deux jeux, un seul compte

L'accueil ouvre sur deux onglets : **TRADING** et **ROULETTE**. Même compte, même
pseudo, même photo, même série de jours — mais **deux portefeuilles séparés**
(10 000 $ au trading, 50 € à la roulette) et **deux classements séparés**.

### Roulette

Roulette européenne : 37 cases, un seul zéro. La roue est dessinée au canvas,
la bille tourne en sens inverse, ralentit, rebondit sur les déflecteurs et se pose
dans la case. **Le numéro est tiré avant l'animation** par `crypto.getRandomValues`,
avec rejet du modulo pour éviter tout biais : la bille rejoint une case déjà décidée.

Mises acceptées : numéro plein (paie 35), douzaine et colonne (paient 2), rouge,
noir, pair, impair, 1 à 18, 19 à 36 (paient 1). Les jetons vont de 1 € à 25 €.
Le mode SIMPLE masque les douzaines et les colonnes.

Statistiques sur les 100, 1 000 ou 10 000 derniers tours du joueur, plus les
30 derniers numéros affichés. **L'app dit clairement que ces chiffres ne prédisent
rien** : chaque tour est indépendant et la banque garde 2,7 % de chaque mise.
C'est le contraire exact du trading, où les cycles ont une forme.

Caisse à zéro : recapitalisation à 50 € et compteur de ruines incrémenté.

## Réglages avant chaque partie de trading

Avant de lancer un cycle, deux curseurs :

- **Ce que tu engages** — de 5 % à 100 % du portefeuille (100 % par défaut).
  Le reste est mis de côté et ne bouge pas.
- **Nombre de manches** — de 5 à 25, par pas de 1 (10 par défaut).
  Le cycle est découpé en autant de moments de décision.

## Classements et fiches

Deux onglets de jeu, puis les mesures propres à chaque jeu. **Appuyer sur un joueur
ouvre sa fiche** : ses chiffres des deux jeux, sa courbe d'argent et ses derniers
cycles. Un badge **SÉRIE** indique le nombre de jours d'affilée où il est venu jouer,
au trading comme à la roulette.

## Deux modes, une seule progression

Bascule **SIMPLE / PRO** en haut de chaque écran. Même compte, même portefeuille,
même scoring : seule la densité d'information change. SIMPLE affiche des mots et
des gestes, PRO affiche les chiffres, les axes et le détail décision par décision.

Un nouveau compte démarre en SIMPLE ; le choix est ensuite mémorisé.

## Sept marchés

Le marché se choisit sur l'accueil, en un mot :

| Marché | Contenu |
|---|---|
| TOUT | les 38 actifs |
| CRYPTO | Bitcoin, Ethereum, XRP, Litecoin, Cardano, Dogecoin, Solana, Chainlink |
| INDICES | S&P 500 depuis 1950, Nasdaq depuis 1971, SPY |
| GÉANTES | Apple, Microsoft, Amazon, Alphabet, Meta, Nvidia, Tesla, JPMorgan… |
| AGITÉES | les huit actions au repli moyen le plus fort, mesuré sur leur historique |
| SECTEURS | tech, énergie, santé, banque, conso, défense |
| ENTREPRISE | une entreprise précise, choisie par recherche |

**391 cycles** au total, répartis en trois formes pour éviter que tout finisse toujours en hausse :

- **cycle complet** — du sommet au sommet suivant (158)
- **descente seule** — la partie s'arrête au creux, aucune reprise (65)
- **après l'euphorie** — on entre en pleine hausse et on finit dans la rechute (134)

Mesuré sur l'ensemble : **53 % finissent plus haut que la première décision, 47 % plus bas**,
médiane +5 %. Le léger biais haussier restant est celui du marché lui-même, pas du jeu. L'actif et la période restent cachés jusqu'à la fin du cycle,
même quand on choisit l'entreprise soi-même.

Les séries de prix sont chargées à la demande : le catalogue pèse 32 Ko, chaque
actif environ 50 Ko, et seul l'actif joué est téléchargé.

## Le recul disponible

Chaque partie donne accès à **jusqu'à 20 ans d'historique** avant la première
décision, quand la donnée existe : médiane 10,7 ans, 207 cycles sur 391 offrent
10 ans ou plus, 41 en offrent 20.

Le graphique change d'unité en dézoomant, comme une vraie plateforme :
bougies **hebdomadaires** jusqu'à 6 ans de large, **mensuelles** de 6 à 13 ans,
**trimestrielles** au-delà. L'unité est affichée à côté de la durée
(« 20 ANS · TRIM. »). Ce sont toujours de vraies bougies, jamais une ligne.

## Les niveaux

Le coût d'un niveau augmente à chaque palier : 7 bonnes décisions pour passer au
niveau 2, 10 pour le 3, 13 pour le 4, 16 pour le 5. **Un niveau sur cinq est doublé** :
38 pour atteindre le niveau 6, 68 pour le niveau 11. Atteindre le niveau 6 demande
84 bonnes décisions au total, soit une quinzaine de cycles bien joués.

## Le portefeuille

Tout le monde commence avec **10 000 $**. Ce portefeuille suit d'un cycle à l'autre :
il n'est pas remis à zéro entre deux parties. S'il tombe sous 500 $, le joueur est
recapitalisé à 10 000 $ et son compteur de **ruines** augmente d'une unité. Ce compteur
est affiché à côté de son nom au classement.

Trois mesures de comparaison, une phrase d'explication pour chacune dans l'app :

- **ARGENT** — ce qu'il reste dans le portefeuille.
- **GAIN** — tout ce qui a été gagné ou perdu depuis le premier cycle, ruines comprises.
- **DÉCISIONS** — sur 100 décisions, combien étaient dans la bonne zone du cycle.

## Les gestes

Glisser à droite pour **ACHETER**, à gauche pour **ATTENDRE**, vers le haut pour
**ENCAISSER**. Le pourcentage engagé va de 5 % à 100 % : deux repères sont dessinés
sur la jauge à 35 % et 66 %, et la tranche est nommée pendant le geste
(PALIER, GROS, TRÈS GROS, TOUT). Rien n'est interdit, mais le bilan pénalise
la concentration et récompense le fractionnement.

## Obligation de dézoomer

**Désactivée par défaut.** Elle s'active depuis la page compte, section Réglages.
Activée, la consigne pointe explicitement le bouton de dézoom, la carte affiche
« DÉZOOME D'ABORD », et un geste tenté trop tôt fait vibrer la carte.

## Rappel quotidien

Une notification par jour, activable depuis la page compte.

Sur iPhone, l'app doit d'abord être installée sur l'écran d'accueil : Safari seul
n'autorise pas les notifications. L'envoi est fait par `.github/workflows/rappel.yml`,
qui lit les abonnés dans Supabase et appelle `tools/rappel.mjs`. Deux secrets sont
à créer dans **Settings → Secrets and variables → Actions** du dépôt :

- `VAPID_PRIVATE` — clé privée des notifications
- `SUPABASE_SERVICE` — clé `service_role` du projet Supabase

Sans ces deux secrets, la tâche s'arrête proprement en le signalant.

## Arborescence

```
index.html                 accueil (reprise de partie, choix du mode)
login.html                 connexion
signup.html                création de compte
app.html                   le jeu (graphique, swipe, bilan de cycle)
profil.html                classement, courbe de calibration, historique
manifest.webmanifest       métadonnées PWA (nom « Trading », icônes)
sw.js                      service worker : jeu disponible hors connexion
assets/css/style.css       design system complet
assets/js/core.js          outils, état global, persistance locale
assets/js/audio.js         effets sonores
assets/data/catalogue.js   catalogue des 38 actifs + 158 cycles
assets/data/S_*.js         une série de prix par actif, chargée à la demande
assets/js/score.js         notation par zone de cycle
assets/js/chart.js         moteur de rendu des bougies japonaises
assets/js/game.js          logique de jeu, swipe, reveal, bilan
assets/js/ui.js            barre de missions, classement, level up, calibration
assets/js/cloud.js         Supabase (auth + sauvegarde)
assets/js/app.js           amorçage de la page de jeu
assets/js/home.js          amorçage de l'accueil
assets/js/auth.js          amorçage des pages connexion / inscription
assets/js/profil.js        amorçage de la page compte
assets/js/notif.js         abonnement au rappel quotidien
tools/rappel.mjs           envoi des rappels (exécuté par GitHub Actions)
assets/sounds/*.mp3        effets sonores
assets/icons/*.png         icônes d'application
```

## Les icônes

Toutes générées à partir de la même image source (bougies 3D + flèche).

- `icon-180.png` (180x180) : écran d'accueil iPhone
- `icon-192.png` / `icon-512.png` : Android et splash screen
- `icon-512-maskable.png` : version à marge large, pour le rognage circulaire d'Android
- `icon-1024.png` : master
- `logo.png` : version détourée sur fond transparent, affichée dans l'interface sombre
- `favicon.png`, `icon-152.png`, `icon-120.png`, `icon-64.png`, `icon-32.png` : tailles secondaires

Pour changer d'icône : remplacer ces fichiers en gardant les mêmes noms.
Le nom « Trading » vient de `manifest.webmanifest` et de la balise
`apple-mobile-web-app-title` présente dans chaque page.

## Données

Bougies hebdomadaires réelles issues de Financial Modeling Prep :
S&P 500 depuis 1950, Nasdaq Composite depuis 1971, Bitcoin depuis 2010.
29 cycles détectés automatiquement (repli minimum de 18 % sur actions,
45 % sur Bitcoin), du krach de 1973-74 à la bulle dot-com, 2008, le Covid
et les cycles Bitcoin.

Le scoring est toujours calculé par **zone** de cycle, jamais en binaire :
la position du prix entre le creux du cycle et le sommet précédent pour un
achat, entre le creux et le sommet suivant pour une prise de profits.

## Backend

Projet Supabase, tables `cyc_profiles` et `cyc_sessions`, sécurité au niveau
des lignes activée. L'URL et la clé publique sont dans `assets/js/cloud.js`.
La clé `anon` est publique par conception : les politiques RLS empêchent un
joueur de lire ou modifier les données d'un autre.

## Avertissement

Outil pédagogique. Aucune recommandation d'investissement, aucune promesse
de performance. Les performances passées ne préjugent pas des performances
futures.
