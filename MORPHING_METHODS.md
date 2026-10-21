# Méthodes retenues pour le morphing entre deux identités

Décision de conception du 18 octobre 2026, complétée les 20 et 21 octobre. Lire d'abord
[la mission et les critères de réussite](MORPHING_OBJECTIVE.md).
Les choix ci-dessous sont un programme de développement. Un premier jalon est
implémenté : géométrie commune du portrait complet, repère de taille/rotation
partagé, ouvertures ordonnées, régularisation MLS avec garde-fous, sélection
locale de texture selon la visibilité et extrémités A/B exactes. La fusion
multirésolution et le guidage 3D restent à développer. La visibilité actuelle
est une heuristique 2D, sans reconstruction des surfaces cachées.
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

## Jalon V18 : tailles différentes et ouvertures différentes

Le moteur sépare maintenant le cadrage 2D de la forme : les quatre coins des
yeux définissent un repère indépendant de l’ouverture des paupières, la taille
évolue géométriquement et la rotation prend le chemin court. Le visage et le
contour de tête suivent ce même repère ; le bord du cadre reste fixe. Cela
évite le rétrécissement artificiel d’une interpolation de rotation en pixels.
Cela ne rectifie pas la perspective 3D : les différences de proportions
observées restent traitées par le maillage sémantique.

La sélection de texture concerne exclusivement les cavités internes de bouche
et d’yeux. Leur aire divisée par leur largeur au carré mesure l’ouverture sans
dépendre de l’échelle. Des poids de fiabilité continus favorisent une source
ouverte face à une source fermée. Une carte de poids 16 bits commune aux deux
moteurs conserve le coefficient global sur les lèvres, paupières et la peau.
Le choix est limité aux images réellement observées ; il ne crée ni dents ni
iris absents des deux photos. Si les deux cavités sont ouvertes, leurs détails
peuvent encore se dédoubler.

Le contrôle de compatibilité distingue désormais les anciens modes, qui
recentrent B sur A, et le moteur complet, qui conserve les cadres d’origine.
Si le premier contrôle refuse une paire mais que les deux cadres bruts, la
trajectoire faciale réelle et les anneaux de contexte sont valides, seul le
mode complet est autorisé. Les autres modes restent désactivés. Les seuils
anciens ne sont pas assouplis.

Je n’ajoute pas une pyramide mélangée uniformément en espérant supprimer les
images fantômes : avec les mêmes poids à tous les niveaux, la linéarité donne
le même fondu. Les raccords multibandes seront évalués avec des masques spatiaux,
après la correspondance géométrique et la visibilité. La V18 privilégie donc
une correction locale vérifiable, sans altérer la couleur ou l’identité de
l’ensemble du visage pour favoriser la bouche.

Voir le [bilan V18](Taquin%20deux%20visages%20interpol%C3%A9s/qa/v18-visibility-2026-10-18.md)
pour les comparaisons réelles et leurs limites.

Les ouvertures oculaires reçoivent aussi un centre d’iris lorsque celui-ci est
strictement intérieur à un contour simple et que tous les triangles radiaux
restent orientés aux deux extrémités et aux 33 positions vérifiées. Les deux
pupilles sont ainsi déformées vers une même position, au lieu de ne recaler que
les paupières. Chaque œil peut revenir indépendamment aux bandes historiques
si le centre est absent, l’œil fermé ou la géométrie ambiguë. Ce contrôle est
basé sur les [repères du modèle MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker),
pas sur une estimation de profondeur métrique ni une reconstruction de l’œil.

## Jalon V19 : détourer avant toute déformation

Le décor et les vêtements de deux prises de vue différentes n'ont aucune
correspondance faciale. Leur fondu produit des superpositions que le recalage
des yeux et de la bouche ne peut pas corriger. Je retiens donc une préparation
commune des sources : tête isolée, fond blanc opaque, puis morphing habituel.
Cette préparation est appliquée à tous les modes et aux anciennes archives.
Les extrémités exactes désignent désormais ces portraits préparés ; les images
recadrées originales restent séparées pour l'export privé.

Le modèle MediaPipe Selfie Multiclass distingue cheveux, peau du visage,
accessoires, peau du corps et vêtements. Un simple masque de personne aurait
conservé le cou et la chemise. La V19 retient les classes cheveux/visage/accessoires,
bornées autour de la tête et reliées au visage connu. Elle remplit aussi tout
l'ovale facial pour que des erreurs de segmentation ne trouent pas les yeux,
les lunettes, les dents ou la bouche ouverte. Un adoucissement intérieur de deux
pixels réduit les marches du contour. L'harmonisation lumineuse respecte ce
masque et laisse le blanc extérieur intact.

Cette décision s'appuie sur la [documentation officielle des classes MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)
et la [fiche du modèle multiclasses](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf).
Le modèle est chargé une fois pendant la préparation de la paire ; les images
restent dans le navigateur. Si le masque manque ou échoue, le moteur utilise
l'ovale facial sur blanc avec un avertissement : les cheveux peuvent être coupés.

Le détourage supprime le bruit extérieur, mais ne résout ni les doubles mèches,
ni les textures internes mal alignées. Des liserés ou des oreilles tronquées
restent possibles. Les tests privés restent locaux et ne valident pas à eux
seuls deux identités différentes. Le [bilan V19](Taquin%20deux%20visages%20interpol%C3%A9s/qa/v19-white-background-2026-10-20.md)
sépare ces observations des contrôles techniques publics.

## Jalon V20 : surface faciale de synthèse en 3D

La nouvelle demande consiste à créer une représentation 3D de chaque visage,
puis à transformer la forme et l'expression de A vers B dans cet espace.
Je retiens d'abord une surface faciale XYZ issue des profondeurs relatives déjà
fournies par MediaPipe. Elle peut être rendue en argile, tournée et inclinée,
indépendamment des textures. Cette séparation permet de voir si le volume
change correctement avant de juger le mélange des deux photos.

Les coordonnées Z de MediaPipe sont estimées et mises à l'échelle comme X sous
une projection en perspective faible. Elles ne sont pas des distances mesurées.
La [documentation officielle Face Mesh](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md)
distingue ces coordonnées du module de géométrie métrique. La V20 n'intègre pas
ce module métrique et ne prétend pas connaître la focale des photos.

Un repère XYZ orthonormal fondé sur les coins des yeux et le front sépare le
cadrage de la forme. Les rotations des repères sont interpolées par quaternion,
la taille géométriquement et les formes XYZ dans le repère commun. Cela évite
d'écraser le visage entre deux rotations. Les lèvres et paupières gardent les
correspondances sémantiques du moteur précédent. Une cavité de bouche bornée
par l'ouverture est ajoutée pour examiner une bouche ouverte en argile ; sa
profondeur est heuristique et ne reconstruit ni langue ni dents.

Le rendu utilise un vrai tampon de profondeur WebGL et des normales recalculées.
L'argile reçoit un éclairage simple. Le matériau photographique projette les
deux textures sur la surface commune, en lumière linéaire, avec la sélection
de visibilité limitée aux cavités. Il conserve l'éclairage déjà présent dans
les photos. Aucun portrait de fond n'est superposé à la surface.

Je choisis cette étape parce qu'elle est inspectable, locale, compatible avec
les données existantes et testable sans entraîner ni télécharger un autre
modèle de visage. Elle fournit un prototype 3D, pas une garantie de meilleur
photoréalisme : une mauvaise correspondance des textures peut encore se voir.
Un modèle de tête complet et un ajustement de caméra/identité/expression plus
contraint restent nécessaires pour des perspectives éloignées. Les cheveux,
les oreilles, le crâne et les surfaces cachées sont absents de cette surface.

Le trajet projeté 3D est contrôlé séparément à 33 positions. Une paire peut
activer Surface 3D si ce contrôle et le contrôle commun réussissent, même si
l'ancien recalage 2D B vers A est refusé. Les autres modes refusés restent
désactivés. Une absence de profondeur ou de GPU produit un message explicite,
sans présenter un fondu 2D comme un résultat 3D.

Voir [le bilan V20](Taquin%20deux%20visages%20interpol%C3%A9s/qa/v20-surface3d-2026-10-21.md).
