# Validation algorithmique exploratoire de la v15 sur des portraits Internet

Date du test : 26 août 2026.

## Conclusion

La reproduction CPU de la chaîne géométrique de la v15 accepte deux identités et deux expressions différentes lorsque les deux portraits offrent une perspective suffisamment proche. Le cas le plus net du test oppose un visage à bouche fermée à un autre à bouche ouverte : la paire est acceptée, le maillage facial MediaPipe reste stable et aucune rupture n'est visible aux positions 25, 50 et 75 % dans la reproduction CPU. C'est un résultat encourageant sur l'algorithme, pas encore une preuve de bout en bout dans Safari/WebGL.

Ce résultat ne démontre pas une robustesse générale. La v15 ne reconstruit toujours pas les parties cachées par un changement de perspective. Elle refuse donc volontairement certaines paires, y compris deux photos de la même personne, lorsque l'écart de vue est trop important. Les cheveux, une main, un microphone, des lunettes, une ombre dure ou un arrière-plan très différent peuvent aussi produire un mélange visible sans déclencher l'alarme géométrique.

## Protocole

- Sept photos Internet représentant six personnes ont été téléchargées temporairement. Quatre variantes contrôlées ont ajouté un assombrissement à 58 % et une réduction à 58 % de la largeur et de la hauteur.
- Une reproduction Python native des étapes de la page a exécuté la première détection, le recadrage carré automatique, une nouvelle détection à 512 px, 478 repères, le contrôle de lumière et le contrôle de qualité. Elle utilise le même modèle et les mêmes seuils, mais pas l'implémentation JS/WASM ni un décodage des pixels nécessairement identique à celui du navigateur.
- Le paquet Python MediaPipe 0.10.35 a utilisé le même modèle Face Landmarker `float16/1` et les mêmes seuils que la v15 ; son moteur d'exécution natif diffère de MediaPipe Tasks Vision dans la page.
- Chaque paire a ensuite été soumise au seuil de perspective de la v15 (`poseGap <= 0,34`) et au contrôle de repli, d'effondrement, d'étirement et de sortie du cadre du maillage.
- Une reproduction CPU du maillage plein cadre a généré 0, 25, 50, 75 et 100 %. Comme le shader, elle décode les couleurs sRGB, les mélange en lumière linéaire, puis les réencode en sRGB. Cette passe permet une inspection visuelle, mais elle ne valide pas le pilote WebGL d'un iPhone.
- Le Selfie Segmenter tête/cheveux n'a pas été exécuté dans ce banc : le plein cadre utilise volontairement le contour géométrique de secours. Les résultats prouvent donc que ce repli reste continu, pas que chaque coiffure sera correctement segmentée.
- Les photos, repères, scripts transitoires et rendus dérivés ne sont pas versionnés. Seuls le présent rapport et le [manifeste des URL, empreintes et réglages](./v15-internet-test-manifest.json) sont conservés. Le manifeste rend les entrées retrouvables, mais ne suffit pas à régénérer seul les scores ou les rendus.

Les degrés ci-dessous sont l'indication d'angle produite par l'heuristique interne de la v15 (`yaw × 45`) ; ce ne sont pas des degrés physiques calibrés par une caméra.

## Résultats

Les onze entrées ont été détectées et acceptées par le contrôle de captation : 11/11, sans image rejetée.

| ID | Paire et variation | Écart de perspective | Écart d'ouverture de bouche | Décision selon les seuils v15 | Contrôle du maillage | Inspection des cinq images |
|---|---|---:|---:|---|---|---|
| D1 | Biden ↔ Lin-Manuel Miranda, bouche fermée ↔ ouverte | 2,13° | 0,169 | Acceptée | Stable, 100/100, 852 triangles faciaux | Pas de rupture visible aux trois positions intermédiaires échantillonnées. Le microphone et l'épaule restent visibles en transparence dans le plein cadre. |
| D1-L | D1 avec la seconde photo assombrie à 58 % | 1,63° | 0,171 | Acceptée | Stable, 100/100 | Aucun trou ou triangle noir dans le rendu OpenCV. La géométrie résiste ; la transition brute devient plus sombre et dépend de l'harmonisation locale de la page. |
| D1-S | D1 avec le second portrait réduit à 58 % avant import | 1,52° | 0,171 | Acceptée | Stable, 100/100 | Le recadrage ramène le rapport d'échelle interoculaire final à 99,9 %. Aucun trou aux trois positions intermédiaires du rendu OpenCV. |
| D2 | Biden ↔ Alex Lacamoire, bouche fermée ↔ grand sourire | 10,35° | 0,129 | Acceptée | Stable, 97/100 | Pas de rupture aux trois positions intermédiaires, mais le regard et l'ombre dure deviennent artificiels au milieu. Le score géométrique ne mesure pas ce défaut esthétique. |
| D3 | Jeanette Epps ↔ Megan McArthur, deux sourires différents | 7,99° | 0,077 | Acceptée | Adaptée, 96/100 | Résultat visuel propre sur les cinq positions de la reproduction OpenCV malgré les cheveux et fonds différents. |
| S0 | Obama souriant ↔ Obama parlant, même identité | 32,03° | 0,216 | Refusée | Le maillage seul serait adapté, 85/100 | Refus conforme au seuil v15 : la perspective commune manque, même si l'identité est la même. |
| R0 | Obama parlant ↔ Megan McArthur souriante | 26,76° | 0,199 | Refusée | Le maillage seul serait adapté, 88/100 | Refus conforme au seuil v15 : deux identités et deux expressions ne compensent pas des vues incompatibles. |

Les quinze images intermédiaires des cinq paires acceptées ne contiennent aucun trou noir produit par le rasteriseur OpenCV. L'examen de ces échantillons confirme toutefois que « stable » ne signifie pas toujours « naturel » : D2 conserve une géométrie valide alors que le regard et l'éclairage paraissent artificiels.

## Sources

- Les portraits Obama, Obama 2, Biden, Lin-Manuel Miranda et Alex Lacamoire proviennent du [répertoire d'exemples `face_recognition`](https://github.com/ageitgey/face_recognition/tree/master/examples). Ils n'ont été utilisés que comme données de test transitoires et ne sont pas redistribués.
- Les portraits de [Jeanette Epps](https://commons.wikimedia.org/wiki/File:Jeanette_J._Epps.jpg) et [Megan McArthur](https://commons.wikimedia.org/wiki/File:Megan_McArthur,_official_portrait_(2020)_(cropped).jpg) sont des portraits officiels NASA signalés comme domaine public sur leurs pages Wikimedia Commons.

## Ce qui reste à vérifier sur l'iPhone

L'environnement de navigateur automatisé disponible pendant ce test ne fournissait pas de contexte WebGL utilisable ; MediaPipe lui-même échouait à l'import d'une photo dans cet environnement. Il n'a donc pas été utilisé comme fausse preuve de fonctionnement GPU.

Le contrôle final doit être fait dans Safari sur un vrai iPhone : ouverture de la caméra, import de D1 ou d'une paire équivalente, statut réellement « WebGL » sans repli Canvas 2D, dix boucles complètes sans écran noir ni perte de contexte, puis inspection à 25, 50 et 75 %. La caméra et le rendu WebGL restent deux sous-systèmes distincts : le présent test observe, hors navigateur, la détection Python, la logique de sélection et trois positions intermédiaires d'une reproduction OpenCV ; il ne valide ni la page JS/WASM, ni Canvas 2D, ni le rasteriseur WebGL mobile.
