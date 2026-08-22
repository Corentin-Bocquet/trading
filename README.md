# Trading — entraîneur de cycles de marché

Application web (PWA) d'entraînement à la lecture des cycles boursiers.
Le principe : on ne tope jamais le point exact, on reconnaît une **zone**,
on **dézoome**, et on **fractionne** ses entrées et ses sorties par paliers.

## Lancer l'app

### En local, tout de suite
Ouvre `index.html` dans un navigateur. Tout fonctionne, y compris le compte
Supabase et le classement.

### Pour l'installer sur l'écran d'accueil iPhone
iOS exige une adresse **https**, un fichier local ne suffit pas. Héberge le
dossier tel quel (Netlify Drop, Vercel, GitHub Pages, ton propre serveur),
puis dans Safari : **Partager → Sur l'écran d'accueil**. L'app s'ouvre alors
en plein écran, sans barre de navigateur, sous le nom **Trading**.

Sur Android : menu ⋮ → **Installer l'application**.

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
assets/js/data.js          données OHLC réelles + scénarios de cycle
assets/js/score.js         notation par zone de cycle
assets/js/chart.js         moteur de rendu des bougies japonaises
assets/js/game.js          logique de jeu, swipe, reveal, bilan
assets/js/ui.js            barre de missions, classement, level up, calibration
assets/js/cloud.js         Supabase (auth + sauvegarde)
assets/js/app.js           amorçage de la page de jeu
assets/js/home.js          amorçage de l'accueil
assets/js/auth.js          amorçage des pages connexion / inscription
assets/js/profil.js        amorçage de la page progression
assets/sounds/*.mp3        effets sonores
assets/icons/*.png         icônes d'application
```

## Version fichier unique

`trading-fichier-unique.html` contient toute l'application dans un seul fichier
(données, sons en base64, images comprises). Pratique pour l'envoyer par message
ou l'ouvrir d'un double-clic. Elle n'a pas les pages séparées ni le mode PWA.

## Les icônes

Toutes générées à partir de la même image source (bougies 3D + flèche).

- `icon-180.png` (180x180) : écran d'accueil iPhone
- `icon-192.png` / `icon-512.png` : Android et splash screen
- `icon-512-maskable.png` : version à marge large, pour le rognage circulaire d'Android
- `icon-1024.png` : master
- `logo.png` : version détourée sur fond transparent, affichée dans l'interface sombre de l'app
- `favicon.png`, `icon-152.png`, `icon-120.png`, `icon-64.png`, `icon-32.png` : tailles secondaires

Pour changer d'icône plus tard : remplace ces fichiers en gardant les mêmes noms.
Le nom « Trading » vient de `manifest.webmanifest` et de la balise
`apple-mobile-web-app-title` présente dans chaque page.

## Données

Bougies hebdomadaires réelles issues de Financial Modeling Prep :
S&P 500 depuis 1950, Nasdaq Composite depuis 1971, Bitcoin depuis 2010.
29 cycles détectés automatiquement (repli minimum de 18 % sur actions,
45 % sur Bitcoin), du krach de 1973-74 à la bulle dot-com, 2008, le Covid
et les cycles Bitcoin.

## Backend

Projet Supabase `learno`, tables `cyc_profiles` et `cyc_sessions`,
sécurité au niveau des lignes activée. L'URL et la clé publique sont dans
`assets/js/cloud.js`. La clé `anon` est publique par conception : les
politiques RLS empêchent un joueur de modifier le profil d'un autre.

## Avertissement

Outil pédagogique. Aucune recommandation d'investissement, aucune promesse
de performance. Les performances passées ne préjugent pas des performances
futures.
