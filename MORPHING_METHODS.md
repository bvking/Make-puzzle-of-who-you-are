# Méthodes retenues pour le morphing entre deux identités

Décision de conception du 18 octobre 2026. Lire d'abord
[la mission et les critères de réussite](MORPHING_OBJECTIVE.md).
Les choix ci-dessous sont un programme de développement. Un premier jalon est
implémenté : géométrie commune du portrait complet, ouvertures ordonnées,
régularisation MLS avec garde-fous et extrémités A/B exactes. Le traitement de
visibilité, la fusion multirésolution et le guidage 3D restent à développer.
Voir le [bilan du nouveau moteur](Taquin%20deux%20visages%20interpol%C3%A9s/qa/full-face-engine-2026-10-18.md)
pour les vérifications réelles et les limites ; l'ensemble du but n'est pas validé.

## Commentaire sur le choix des méthodes

Je retiens une chaîne qui corrige successivement la correspondance des formes,
la visibilité des surfaces et les raccords de texture. Le problème observé dans
le moteur local est structurel : il mélange une région déformée avec la photo A
non déformée. Ajouter des ovales transparents peut atténuer une couture, mais ne
fait pas évoluer ensemble la bouche, les joues et la mâchoire vers B.

Le moteur final doit donc déformer les deux sources vers une même forme
intermédiaire, sur tout le visage, avant de mélanger leurs textures. Les yeux,
le nez et le contour doivent changer d'identité eux aussi. La déformation sera
régularisée pour limiter les étirements ; l'intérieur de bouche recevra une
gestion de visibilité distincte ; la fusion multirésolution traitera ensuite
les différences de lumière aux frontières. Une estimation 3D de la pose sera
développée après cette base pour réduire les limites du recalage 2D.

Ce choix est adapté au code déjà présent et permet des comparaisons progressives
dans le navigateur. Sa pertinence pour ce dépôt est une décision d'ingénierie,
pas un résultat démontré par les publications citées. Chaque méthode devra être
acceptée ou écartée sur les mêmes paires de personnes différentes.

## 1. Base retenue : géométrie commune sur le visage complet

Réutiliser les repères MediaPipe et les deux moteurs de rendu existants, mais
construire une topologie sémantique commune et stable. Les deux images sources
doivent être échantillonnées vers la même géométrie intermédiaire.

- Préserver les contours des lèvres, paupières et ouvertures. Éviter les
  triangulations libres qui traversent une ouverture ou changent entre images.
- Traiter explicitement les triangles presque dégénérés d'une bouche ou d'un
  œil fermé, sans étirer leur texture sur toute une surface nouvellement visible.
- Interpoler tous les traits de A vers B. La stabilisation d'une paire ne doit
  pas maintenir la pose, les yeux, la mâchoire ou le contour de A à l'arrivée.
- Définir une trajectoire de cadrage et de pose qui retrouve les deux extrémités.
  Le fond ne doit pas conserver une ancienne silhouette sous le visage animé.
- Unifier les contrats WebGL/Canvas 2D : le moteur Canvas ne doit pas ignorer
  une géométrie fournie à 100 %. Le raccourci actuel vers la photo B brute doit
  être vérifié dans le contexte du nouveau contrat, pas corrigé isolément par
  une exception qui conserverait B recalé sur A à l'extrémité finale.

Pourquoi : la méthode classique déforme les deux sources avant le fondu, ce qui
fait coïncider les traits. L'application à l'ensemble du visage répond au but
de changement d'identité. [Référence pédagogique CMU](https://graphics.cs.cmu.edu/courses/15-463/2012_fall/hw/proj4-morph/).

## 2. Déformation retenue : MLS de similarité pour la régularisation

Prototyper une déformation par **Moving Least Squares de similarité**, pilotée
par des contrôles sémantiques répartis sur tout le visage. L'évaluer sur une
grille/maillage, puis utiliser le rendu triangulaire existant pour les textures.
Conserver le moteur actuel comme référence de comparaison.

Pourquoi ce choix : les variantes de similarité limitent le cisaillement tout
en autorisant des changements d'échelle locaux, nécessaires pour passer entre
deux morphologies différentes. Le papier propose des calculs explicites avec
des parties précalculables. La variante rigide n'est pas retenue comme contrainte
générale : des proportions de visage doivent pouvoir changer.
[Article original de Schaefer, McPhail et Warren](https://people.engr.tamu.edu/schaefer/research/mls.pdf).

Dans notre adaptation, aucune région oculaire ne reste attachée à A pendant
tout le morphing. Un ensemble de contrôles peut se comporter comme un bloc
cohérent à l'intérieur d'une source, mais sa cible doit évoluer vers B.
MLS n'est ni un modèle anatomique ni une garantie d'absence de replis : contrôler
les intersections, les aires et les étirements à chaque étape. Ne pas lisser
simultanément les deux côtés d'une ouverture comme s'ils étaient de la peau.

Les **poids biharmoniques bornés** restent une alternative si MLS ne contrôle
pas assez bien les influences entre régions. Ils ne seront pas cumulés d'emblée
avec MLS, afin de comparer leur effet et leur coût séparément.
[Projet et code de référence ETH Zurich](https://igl.ethz.ch/projects/bbw/).

## 3. Bouche et yeux : visibilité et textures distinctes

Séparer peau, lèvres et intérieur de bouche ; appliquer le même principe aux
ouvertures des yeux. Une surface absente dans A ne doit pas être fabriquée en
étirant la peau ou les lèvres de A. Les contributions de texture doivent tenir
compte de la visibilité et de l'ouverture courante.

Reprendre l'idée de sélection d'une texture de bouche adaptée à l'expression
dans les vues réellement capturées. **Ne pas reprendre le but de Face2Face**, qui
conserve une identité cible : ici l'apparence doit elle aussi passer de A à B.
Les dents de A ne doivent pas être conservées à 100 % si B en possède d'autres.
[Face2Face, section 8 « Mouth Retrieval »](https://niessnerlab.org/papers/2016/1facetoface/thies2016face.pdf).

Le premier prototype doit accepter les deux images disponibles. Des ouvertures
supplémentaires peuvent améliorer la qualité lorsqu'elles existent dans les
scans ; elles ne deviennent pas une nouvelle exigence cachée. Ne pas promettre
la restitution exacte d'un intérieur invisible dans toutes les sources.

Limiter un éventuel biais de texture à la région concernée. Les joues, le nez
et le front ne doivent pas recevoir le coefficient accéléré de la bouche.
Éviter les changements brusques de source, garantir A/B aux extrémités et
vérifier aussi la lecture inverse de l'animation.

## 4. Fusion retenue : pyramides laplaciennes sur les raccords de peau

Après la correction géométrique, développer une fusion multirésolution :
transition large pour la lumière et la couleur, transition plus fine pour les
détails. La limiter aux raccords nécessaires ; conserver les lèvres, dents,
pupilles et montures dans des régions contrôlées pour éviter leur dédoublement.

Pourquoi : elle traite les échelles de détail séparément, là où un seul masque
alpha applique la même transition aux ombres et aux détails fins.
[Principe et exemple officiel OpenCV](https://docs.opencv.org/4.x/dc/dff/tutorial_py_pyramids.html).

Adapter l'algorithme au navigateur, mesurer temps et mémoire sur iPhone ; les
exemples OpenCV ne constituent pas une intégration JavaScript prête à l'emploi.
Le nombre de niveaux devra être choisi par comparaison visuelle et mesure.
La fusion de Poisson restera un essai alternatif si des coutures photométriques
subsistent, pas le premier remède aux erreurs de géométrie.
[Documentation OpenCV sur le clonage de Poisson](https://docs.opencv.org/4.x/df/da0/group__photo__clone.html).

## 5. Pose : guidage 3D dans un second jalon

Exploiter la géométrie faciale canonique et l'estimation de pose pour distinguer
les changements de tête des changements d'expression. Réutiliser les textures
observées dans les scans et leur visibilité selon la vue.

Pourquoi : un recalage 2D ne modélise pas toute la perspective. MediaPipe décrit
une surface canonique, une transformation de pose et une projection caméra.
Cela fournit une base de guidage, pas une reconstruction exacte de chaque tête.
Les coordonnées Z relatives ne doivent pas être utilisées comme une mesure
métrique sans modèle de caméra approprié.
[Documentation officielle Face Mesh / Face Geometry](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md).

Ce jalon ne bloque pas le développement du morphing entre vues proches, mais
reste nécessaire avant de revendiquer la gestion de perspectives plus éloignées.
La pose finale et les textures visibles doivent rejoindre B, pas une copie de B
indéfiniment alignée sur la pose de A.

## Ordre de développement et preuve attendue

1. Constituer la matrice de validation de la mission, vérifier les extrémités et
   établir une référence du moteur complet actuel avec les mêmes entrées.
2. Mettre en place la géométrie commune, puis comparer la régularisation MLS.
   Vérifier le mouvement du visage entier et le contour, pas seulement la bouche.
3. Développer la visibilité des ouvertures et le mélange local des textures.
4. Comparer la fusion multirésolution à un mélange simple, après déformation.
5. Ajouter le guidage de pose 3D et élargir le banc de perspectives testées.

À chaque étape : comparer avant/après, tester les positions et les deux moteurs,
mesurer sur appareil, distinguer progrès observés et limites, créer un commit
par évolution et pousser la branche expérimentale. Si une méthode dégrade les
images, conserver la référence et documenter le résultat au lieu de la déclarer
validée parce que ses tests numériques passent.

Les modèles génératifs et le flux optique entre identités différentes ne sont
pas retenus pour le premier moteur : ils ajoutent une autre estimation des
correspondances ou des contenus, alors que le défaut actuel de composition doit
d'abord être isolé et corrigé. Cette priorité n'exclut pas leur évaluation future.

Toutes les comparaisons privées restent locales. Aucun portrait privé, scan,
repère facial ni capture d'écran privée ne doit accompagner ces documents,
commits, commentaires GitHub ou artefacts de CI.
