# Morphing V15 / browser-morph-v16 — bilan et travaux à faire

Date : 10 octobre 2026, Europe/Paris.

Code examiné : `browser-morph-v16`, commit GitHub
`6dfeefddf4140a7cf71020294c3746b9f8a4012d`.
Ce bilan conserve l’état de la candidate ; il n’implémente pas les corrections
décrites ci-dessous. Les captures et portraits personnels ne sont pas publiés
dans le dépôt.

## Objectif et décision actuelle

Permettre une transition fluide entre deux expressions d’un même visage, puis
entre des personnes différentes, en adaptant la forme, l’échelle et la lumière
sans contours dédoublés ni rupture du maillage. Le cou, les cheveux et le fond
doivent aussi former une composition cohérente.

La candidate exige encore une perspective commune suffisamment proche. Elle
ne reconstruit pas les surfaces cachées par un changement de point de vue.
Les tests automatisés passent, mais le résultat visuel demandé n’est pas encore
validé. Garder cette étape sur `browser-morph-v16` ; ne pas fusionner dans
`main` avant correction des défauts observés et validation sur Safari/iPhone.

## Observations du test utilisateur dans Chrome sur Mac

Deux scans du même visage avec une différence d’ouverture de bouche nettement
visible ont fourni les captures suivantes. Les noms identifient les preuves
partagées dans la discussion, sans les incorporer au dépôt.

| Capture du 10 octobre | Mode affiché | Observation vérifiable |
| --- | --- | --- |
| 15:22:09 | Triangles WebGL | Contours translucides dédoublés sous le menton, sur le cou et dans le décor. Le statut indique un rendu WebGL du portrait complet, avec 1 142 triangles. |
| 15:22:40 | Triangles 2D | Défauts visuels très similaires. Le statut indique Canvas 2D, avec 1 142 triangles. |
| 15:23:27 | Régions | Le fond paraît plus net, mais la bouche et les paupières ont une autre apparence. Le statut indique une animation figée. |

Le pourcentage de transition et les poids de chaque région ne sont pas visibles
sur ces captures. Elles ne prouvent donc pas une comparaison des trois modes à
50 %, ni une supériorité de Régions à état égal. Des images fixes ne permettent
pas de mesurer la fluidité, les sauts de maillage ou les pertes de contexte.

L’interface indique une échelle relative de 93 %, un écart de perspective de
1° et « Maillage stable · 100/100 ». Le premier nombre est un facteur d’échelle,
pas une précision de détection. L’angle affiché est une estimation interne,
pas une mesure calibrée. Le score est calculé à partir de risques géométriques
(repli, effondrement, étirement, sortie du cadre) : il ne mesure ni le réalisme
du morphing, ni l’absence de doubles contours.

## Diagnostic : faits du code et hypothèses à vérifier

- WebGL et Canvas 2D déforment les deux photos vers une géométrie commune avant
  de mélanger les textures. Ce n’est donc pas, en fonctionnement normal, une
  simple superposition de deux photos sans déformation. Leur ressemblance dans
  les captures oriente vers un problème commun de correspondance ou de
  composition ; elle ne démontre pas une panne spécifique au shader WebGL.
- Les correspondances détaillées viennent des repères faciaux. Les anneaux de
  silhouette et les points du cadre prolongent le maillage, mais ne suivent pas
  précisément les objets du décor, les vêtements et le cou. Un décalage
  résiduel y produit deux contours lors du mélange. C’est l’explication la plus
  probable des transparences observées ; il faut la vérifier sur les deux
  portraits sources et leurs couches déformées séparées.
- Le rendu utilise les coordonnées 2D des repères. L’intérieur de la bouche,
  les dents et les surfaces qui apparaissent ou disparaissent ne disposent pas
  d’un modèle explicite de visibilité. Les triangles ajoutés aux yeux et à la
  bouche ne garantissent pas une correspondance de texture correcte.
- `chooseMorphTopology` évalue la photo B après alignement de similarité ;
  `meshGeometry` utilise les coordonnées B brutes pour le portrait complet.
  `fullFrameGeometry` contrôle l’extension du contour, mais il faut harmoniser
  la validation de la totalité des triangles réellement rendus et de leur
  trajectoire. Cette différence de validation est un risque identifié, pas une
  cause démontrée des artefacts de cette paire.
- Régions compose une face masquée sur la photo A d’origine (`drawBackground`).
  Cela explique un fond plus stable et peut aussi laisser un dédoublement aux
  bords du masque lorsque la géométrie bouge. `mixedRegionTexture` utilise un
  fondu Canvas avec `globalAlpha` : ce chemin ne bénéficie pas automatiquement
  de la même équation de mélange linéaire que les deux modes triangulaires.
- Un changement de mode efface l’état figé précédent et peut relancer
  l’animation. Régions dispose en outre de poids indépendants pour les yeux,
  la bouche et les côtés du visage. Il faut un état de comparaison explicite
  plutôt que supposer que trois captures successives ont les mêmes réglages.

Ajouter des sommets par subdivision ne crée pas de nouveaux repères détectés
ni de correspondances fiables dans le fond. Une solution plus dense doit être
évaluée sur la justesse des correspondances, les occlusions et son coût dans le
navigateur, pas seulement sur le nombre de points.

## Blocages reproduits dans le Chrome distant de test

Ces observations concernent le navigateur distant ; elles ne signifient pas
que Chrome sur le Mac de l’utilisateur ou Safari rencontrent le même blocage.

1. L’ouverture avec `?demo=1` échoue dans `loadDemoPair` lors de `toDataURL` :
   « Tainted canvases may not be exported ». `loadDemoPortrait` charge une image
   par URL sans configurer `crossOrigin`. Examiner l’origine finale, les
   redirections et les en-têtes CORS ; `crossOrigin` seul ne suffit pas si la
   source n’autorise pas la lecture des pixels.
2. L’import manuel de chacun des deux portraits du dépôt produit une exception
   MediaPipe/WASM sur `activeTexture`, après des échecs de création de contexte
   WebGL. Le chemin IMAGE configuré en CPU n’a pas permis de terminer l’analyse
   dans cet environnement.
3. `detectImageDetailed` journalise l’exception puis retourne `null`.
   `cropImportedFace` transforme ensuite ce résultat en « aucun visage
   détecté ». Le message présenté à l’utilisateur confond une panne du moteur
   avec une absence réelle de visage.

Aucun rendu de morphing ni comparaison GPU valide n’a été obtenu dans ce Chrome
distant. Les observations visuelles ci-dessus proviennent des captures du Mac.

## Ce que couvrent réellement les tests

Commande réexécutée le 10 octobre : `npm test`.
Résultat : **32 tests réussis, 0 échec, 0 ignoré**.
Le chiffre de 29 évoqué au début de la revue n’est plus le total courant de
cette branche. Le présent bilan ne reconstitue pas l’exécution historique de
la PR #3.

| Fichier | Nombre | Portée réelle |
| --- | ---: | --- |
| `tests/morph-rendering.test.mjs` | 8 | Calcul CPU du mélange, extrémités, alpha et connectivité ; présence textuelle des formules GLSL et du choix de précision. |
| `tests/multiview-core.test.mjs` | 15 | Fonctions de pose, qualité, photométrie, sélection et rétention de vues, expressions et harmonisation sur entrées synthétiques ou repères fournis. |
| `tests/v15-static.test.mjs` | 9 | Syntaxe, intégrité de V15_alpha, identifiants HTML et présence/absence de constructions attendues dans le code. |

Précisions sur les corrections déjà présentes :

- **Lumière linéaire** : le mélange CPU noir/blanc à 50 % produit 188 en sRGB,
  et les extrémités opaques conservent les 256 valeurs de canal. Le test GLSL
  reconnaît l’équation dans le texte ; il ne compile pas le shader et ne mesure
  pas des pixels issus du GPU.
- **Bords et alpha** : le calcul CPU vérifie que les couleurs cachées de pixels
  totalement transparents ne contaminent pas le résultat, ainsi que plusieurs
  alphas partiels, la symétrie et l’écriture en place. Il ne valide pas le
  filtrage des textures, les coutures de rasterisation ou les franges d’un vrai
  portrait sur Safari.
- **Cache d’indices** : le prédicat `morphTopologyMatches` détecte une
  connectivité différente même avec le même nombre de triangles. Le code de
  rendu l’appelle avant de réutiliser le cache. Le test n’exécute pas
  `gl.bufferData` et ne vérifie pas le rafraîchissement du tampon dans un vrai
  contexte WebGL.
- **Précision du shader** : un test textuel vérifie la sélection de `highp`
  lorsqu’il est disponible et le repli `mediump`. Il ne teste pas les capacités
  ou les résultats d’un pilote Safari.

La suite Node ne lance ni caméra, ni navigateur, ni détection MediaPipe JS/WASM,
ni shader GPU. Elle ne vérifie pas les doubles contours sur des expressions
réelles, les transitions animées entre modes, la rotation du téléphone ou le
retour après mise en arrière-plan. Le workflow GitHub Actions exécute cette
même suite ; une exécution verte ne constitue pas une validation Safari.

## Corrections prioritaires et critères de validation

1. **Rendre la comparaison reproductible.** Conserver la même paire, exposer
   le pourcentage réellement rendu et les poids des régions, puis figer un
   état comparable entre modes. Vérifier 0, 25, 50, 75 et 100 %, ainsi que la
   reprise de l’animation. Réserver un preset Régions homogène à cette
   comparaison, sans supprimer ses transitions artistiques indépendantes.
2. **Distinguer les pannes des refus de capture.** Propager les erreurs du
   détecteur, afficher un message de compatibilité explicite et permettre une
   reprise contrôlée. Valider aussi le chargement de la démonstration avec des
   images dont les pixels sont lisibles, et vérifier les origines/CORS.
3. **Corriger le cou et le contexte.** Examiner séparément les couches
   déformées A/B ; estimer des correspondances pour le cou et le décor avec une
   mesure de fiabilité. Lorsque cette correspondance est insuffisante, proposer
   un fond de référence plutôt que mélanger deux décors décalés. Le traitement
   du visage et celui du fond doivent rester cohérents aux bords et aux
   extrémités de la transition.
4. **Traiter l’ouverture de bouche et les paupières.** Contraindre les contours
   sémantiques, distinguer lèvres/intérieur de bouche, puis traiter la
   visibilité des dents et des zones cachées. Valider sur une bouche fermée
   puis ouverte et sur une ouverture des yeux différente, sans inventer une
   correspondance pour un détail absent de l’une des photos.
5. **Valider la géométrie effectivement rendue.** Contrôler dans le même
   système de coordonnées les triangles du visage, des yeux, de la bouche et
   du contexte sur toute la trajectoire. Conserver les contrôles de cache et
   les replis explicites, sans annoncer une qualité visuelle depuis le seul
   score de stabilité.
6. **Terminer les essais matériels.** Dans Safari sur un vrai iPhone, vérifier
   caméra et import, le statut WebGL réel sans repli, dix boucles, les positions
   intermédiaires, la rotation et le retour d’arrière-plan. Chercher franges
   colorées/noires, trous, flash noir, sauts de géométrie, doubles contours et
   blocages. Refaire la comparaison dans Chrome sur Mac et Firefox avec la
   même paire et les mêmes réglages ; ces essais restent à réaliser.

## Risques restant sur Safari/iPhone

La disponibilité réelle du contexte WebGL pour MediaPipe et pour le rendu,
la compilation/précision GLSL, les conversions alpha et le filtrage, la mémoire
des textures et canvas, ainsi que la reprise caméra/rendu après rotation ou
arrière-plan restent à vérifier sur appareil. La segmentation tête/cheveux
peut aussi utiliser un contour de secours. Aucun de ces points ne permet de
déduire une panne Safari depuis le Chrome distant, ni de garantir Safari depuis
les captures Chrome du Mac.

Le bilan algorithmique précédent reste consultable dans
[v15-internet-portraits.md](./v15-internet-portraits.md). Il porte sur une
reproduction native CPU et ne remplace pas les essais de la page dans les
navigateurs cibles.
