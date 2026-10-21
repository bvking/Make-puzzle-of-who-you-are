# V18 — repère commun et visibilité des ouvertures

Validation locale du 18 octobre 2026, Chrome sur cet ordinateur. Uniquement les
deux portraits publics déjà présents dans le dépôt : visage neutre et sourire.
Aucun scan, photo, repère ou capture privée n’accompagne ce bilan.

## Changements et raison du choix

- Interpoler la forme dans un repère commun de taille et de rotation évite
  l’écrasement artificiel dû à une interpolation directe des coordonnées.
- Privilégier la source montrant réellement l’intérieur d’une bouche ou d’un
  œil évite d’étirer une texture fermée sur une cavité ouverte. Le masque reste
  strictement intérieur ; lèvres, joues, peau et lunettes suivent le mélange
  global. Aucune identité n’est figée sur A.
- Recaler aussi les centres d’iris dans les yeux ouverts limite le dédoublement
  des pupilles. Le maillage radial est utilisé seulement si les contours sont
  simples et les centres strictement intérieurs sur les 33 positions vérifiées ;
  chaque œil revient aux bandes historiques en cas de doute.
- Valider séparément le trajet complet permet d’accepter des cadres bruts sûrs
  que l’ancien recalage B vers A aurait inutilement agrandis et coupés. Les
  modes anciens restent interdits dans ce cas.
- Conserver les couleurs originales et les extrémités exactes permet une
  comparaison contrôlée. Pas de prétendue reconstruction 3D ni de génération
  d’un intérieur invisible.

## Protocole reproductible

Exécuter `node tests/browser/generate-full-morph-qa.mjs`, servir le dépôt sur
localhost puis ouvrir `work/full-morph-qa.html?qa768=1` dans Chrome. Le banc
compare 0/25/50/75/100 %, puis contrôle 0,001 et 0,999, le parcours inverse et
le vrai moteur Canvas de repli. Le panneau et les mesures sont téléchargeables
localement. La référence est le trajet 2D linéaire avec la même topologie de peau et
les mêmes images, avec les ouvertures historiques en bandes et sans sélection de texture ; ce n’est pas une reproduction
pixel exacte de toute la V17 avec MLS.

Trois cas : portraits natifs ; B réduite à 78 % et inclinée de 8° ; B avec une
légère transformation affine et une rotation de −5°. Image, repères et contour
reçoivent la même transformation, avec un fond opaque. Ces variantes testent
le cadrage 2D, pas une nouvelle expression réelle ni la perspective 3D.

## Résultats du navigateur

| Cas | A/B : erreur maximale | Écart moyen/max Canvas–WebGL (0–255) | Inversion A/B : erreur max | Poids modifiés hors cavités | Temps 384 px p50/p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Natif | 0 | 0,090 / 11 | 1 | 0 | 1,7 / 2,5 ms |
| Taille 78 %, rotation 8° | 0 | 0,078 / 11 | 1 | 0 | 5,0 / 7,3 ms |
| Affine légère | 0 | 0,085 / 13 | 1 | 0 | 5,5 / 7,7 ms |

Les 127 tests Node passent localement. Les contrôles graphiques passent dans
les trois cas. Les deux centres d’iris sont effectivement utilisés dans les
trois variantes publiques. Les écarts proches des extrémités
restent sous les seuils du banc (moyenne ≤ 1 et maximum ≤ 32). Les mesures
384 px utilisent quatre échauffements et douze rendus. À 768 px, seulement
trois mesures après échauffement : p95 5,3 / 15,1 / 14,7 ms respectivement.
Ces durées sont des temps d’appel JavaScript incluant le transfert du rendu,
pas une garantie de temps GPU ni une mesure sur iPhone.

Sur le cas natif à 50 %, la bouche de A est presque fermée et B montre les
dents : le poids de texture B atteint 97,56 % au cœur de la cavité. Les yeux
ouverts gardent 50 %, la peau aussi à la quantification 16 bits près.
Visuellement, les dents sont plus lisibles et la texture de la bouche fermée
pèse moins sur l’ouverture. L’ensemble du visage et le cadrage rejoignent B.
Le gain de forme reste modeste quand les prises de vue sont déjà proches.

Le test inverse a révélé l’ancien refus : l’agrandissement vers A créait un
dépassement de 38,16 pixels, supérieur à la limite de 30, alors que les deux
cadres d’origine étaient valides. La validation séparée autorise maintenant
uniquement le moteur complet pour cette paire inversée.

## Limites réelles

Des doubles contours persistent dans les cheveux, les yeux et certains détails
au milieu. Les dents différentes de deux bouches toutes deux ouvertes ne sont
pas mises en correspondance. Il n’y a ni rectification de perspective 3D,
ni reconstruction de parties cachées, ni validation de deux identités avec des
expressions extrêmes. Les tests numériques contrôlent des invariants techniques,
pas le naturel du résultat. Le contrôle de trajectoire examine 33 positions ;
il ne prouve pas l’absence de plis entre elles. Safari/iPhone reste à tester.

La démonstration RawGitHack reçoit aussi un chargement d’image CORS explicite,
pour éviter les canvas contaminés par les redirections d’images publiques.
