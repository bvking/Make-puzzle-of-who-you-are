# Diagnostic de morphing et plan d'échantillonnage — 13 octobre 2026

## Correction expérimentale

**But** : limiter les doubles lèvres, la transparence de la bouche et les dents fantômes dans le mode « Expressions locales » lorsque les expressions A et B sont très différentes.

- **Déformation géométrique** : la géométrie du visage continue d'utiliser strictement `t = 0,25 ; 0,50 ; 0,75` aux diagnostics.
- **Mélange de texture** : `localAppearanceMix(t, A, B_aligné)` examine la différence d'ouverture normalisée `distance(13,14)/distance(61,291)`. Si B ouvre nettement plus la bouche, il donne plus de poids à la texture B après le début de la transition ; si B la ferme, il applique la courbe inverse.
- **Contraintes** : endpoints exacts à 0 et 1, monotonie, absence de changement pour des expressions semblables, comportement symétrique ouverture/fermeture. La compensation concerne la texture et **non** les points géométriques.
- **GPU/CPU** : `geometry.textureMix ?? geometry.t` est utilisé au même endroit dans WebGL et Canvas 2D. Les autres modes ne fournissent pas `textureMix` et gardent leur interpolation classique.
- **Masque local** : centre de la région de bouche opaque, bords dégradés, photographies et repères sources non modifiés.
- **Validation** : tests automatiques Node ; simulations 2D privées hors Safari sur une archive utilisateur contenant une bouche presque fermée et très ouverte. **Aucun portrait ni repère individuel n'est commité**. Le rendu Safari/iPhone demeure à vérifier visuellement.

## Résultats et réserves

Les trois positions intermédiaires montrent bien une progression de l'ouverture dans le test privé. En revanche, un mélange de texture plus orienté vers B ne suffit pas à garantir un rendu naturel si les lèvres, le menton et les joues ne sont pas parfaitement correspondants. Les différences visuelles obtenues dans ce premier essai CPU restent **modestes** ; ne pas présenter cette version comme une solution complète. Les défauts résiduels vers la mâchoire et la bordure des masques exigent une meilleure correspondance morphologique ou un montage de texture multibande. Les calculs CPU utilisés pour inspecter les portraits ne reproduisent pas exactement le moteur Safari/WebGL.

## Étape de calibration multi-photos demandée

Le fichier ZIP **v1** conserve seulement le couple A/B sélectionné. Pour travailler de manière autonome, il faut ensuite développer un **jeu de données privé** organisé par identité, expression et angle, avec :

- **Pour chaque identité** : visage neutre, sourire, bouche ouverte, sourcils levés/yeux ouverts (quatre expressions).
- **Pour chaque expression** : vue de face, environ 15° à gauche et 15° à droite (trois poses).
- **Objectif initial** : environ 12 photos retenues par identité (ou davantage si les enregistrements varient fortement). Les vues ne nécessitent pas une position exactement reproductible de l'iPhone, mais le cadrage doit garder l'ensemble du visage net.
- **Métadonnées** : pose, expression, qualité, luminosité, 478 points MediaPipe, contours, source, éventuelles occlusions ; garder aussi la photo originale en privé si l'utilisateur l'autorise.
- **Évaluation** : sélectionner automatiquement les paires A/B de pose et échelle proches, puis réserver certaines combinaisons au **jeu de test**, indépendamment des paires qui ont servi aux réglages. Mesurer localisation des lèvres, erreur de forme, fantômes de contours et stabilité entre images à 25/50/75 %, sans annoncer une « précision 99,9 % » sans métrique définie.

Ce protocole est une **proposition future**, pas une fonctionnalité d'export multi-photo déjà intégrée. Aucun jeu de visages n'est automatiquement envoyé au dépôt. Il faudra préserver les archives exclusivement dans les fichiers privés de l'utilisateur et demander son consentement explicite avant tout partage.
