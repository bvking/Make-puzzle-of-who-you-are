# Raccords latéraux des joues — expérimentation du 18 octobre 2026

Le mode **Expressions locales** ajoute deux dégradés de faible opacité entre
les commissures et les joues. Leur intensité suit l'ouverture actuelle de la
bouche et reste comprise entre 20 et 26 %. Ces dégradés complètent le masque
existant ; ils ne déplacent aucun sommet du maillage.

Les ellipses suivent l'inclinaison des yeux. Elles restent sous les coins des
yeux et les repères disponibles des paupières inférieures des trois poses
(A, B recalée et image intermédiaire), avec une marge de 18 % de la distance
entre les centres des yeux. Leur largeur est limitée par les repères latéraux
des joues ; leur hauteur s'arrête avant le menton. Chaque côté est calculé
séparément pour les sourires asymétriques. Des proportions dégénérées ou une
place insuffisante désactivent le raccord concerné.

La protection manuelle des lunettes conserve son comportement. Les nouveaux
raccords restent sous la même bande de sécurité même si cette option est
désactivée. La marge géométrique ne constitue pas une détection de lunettes.
Les masques bouche/nez/menton/lèvres et les autres modes restent inchangés.

## Vérifications réalisées

- `npm test` : **82 tests réussis** avec Node 24.15.0, dont neuf nouveaux tests
  de géométrie et d'intégration du masque. La CI existante exécute la suite avec
  Node 22 à chaque push sur cette branche.
- Géométrie : rotation, translation, échelle, miroir, sourire asymétrique,
  ouverture progressive, données absentes ou invalides, absence de mutation
  des entrées et protection commune aux trois poses.
- Intégration : exécution de la fonction réelle `localExpressionMask` à trois
  tailles, vérification des transformations Canvas et des dégradés, maintien
  des opérations de dessin existantes avec et sans protection des lunettes.
- Chrome 155, Canvas 2D réel, points entièrement synthétiques : comparaison
  du masque avant/après sur **18 variantes** (384/768/1536 pixels, trois angles,
  avec/sans miroir). **Aucun pixel modifié dans la bande supérieure protégée**.
  L'écart alpha maximal observé est de 42/255 et reste sous la limite du raccord.
- Exécution du compositeur local réel à **0/25/50/75/100 %**, en simulant ses
  deux sélections de moteur avec des couches synthétiques : A reste identique
  à 0 %, et les ajouts restent sous la zone protégée aux autres positions.
  Ce contrôle ne teste pas le shader WebGL ni le pilote graphique de l'iPhone.

## Limites

Aucune nouvelle validation sur des photographies privées ou sur Safari iPhone
n'a été effectuée. Les contrôles synthétiques confirment le périmètre et les
bords du masque, pas un résultat photoréaliste sur toutes les expressions.
Les changements de perspective et les surfaces occultées restent les limites
du moteur 2D. Aucun scan, portrait ou repère biométrique privé n'est ajouté.
