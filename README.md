# Trading — entraîneur de cycles de marché

Application web (PWA) d'entraînement à la lecture des cycles boursiers.
Le principe : on ne tope jamais le point exact, on reconnaît une **zone**,
on **dézoome**, et on **fractionne** ses entrées et ses sorties par paliers.

## En ligne

**https://corentin-bocquet.github.io/trading/**

Le site est publié automatiquement depuis la branche `main` par GitHub Pages.
Toute modification poussée sur `main` est en ligne une minute plus tard.

## Installer sur l'écran d'accueil

**iPhone** : ouvrir l'adresse ci-dessus dans **Safari** (pas Chrome, iOS
n'autorise l'installation que depuis Safari), bouton **Partager** →
**Sur l'écran d'accueil**. L'app apparaît sous le nom **Trading** avec son
icône, et s'ouvre en plein écran sans barre de navigateur.

**Android** : ouvrir l'adresse dans Chrome, menu ⋮ → **Installer l'application**.

Une fois installée, l'app reste jouable sans connexion grâce au service worker.
Seules la création de compte, la sauvegarde serveur et le classement ont besoin
du réseau.

## En local

Ouvrir `index.html` dans un navigateur suffit pour jouer. Pour retrouver le
comportement exact du site (service worker compris), servir le dossier :

```bash
python3 -m http.server 8000
```

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
