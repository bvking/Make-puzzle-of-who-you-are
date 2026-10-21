# Premier jalon du moteur complet — 18 octobre 2026

## Ce qui est implémenté

Le mode **Morphing complet · nouveau**, proposé par défaut pour une nouvelle
paire, transforme tous les traits et le contour de A vers B. Les modes précédents
restent accessibles pour la comparaison. Le nouveau rendu ne superpose aucune
bouche sur une image A figée et n'applique pas le coefficient de texture de la
bouche au reste du visage.

- Une topologie de peau MediaPipe commune aux deux identités, avec des bandes
  ordonnées pour remplir les ouvertures de bouche et d'yeux. Les connexions de
  ces ouvertures ne sont plus choisies par une Delaunay libre.
- Un champ MLS de similarité précalculé sur le gabarit moyen, avec des contrôles
  sur les contours, lèvres, yeux, sourcils, nez et joues. Les contrôles suivent
  exactement A → B ; la peau environnante reçoit une régularisation progressive
  qui s'annule aux extrémités. Le gabarit moyen lui-même reste la moyenne A/B.
- Une réduction de la régularisation si elle dégrade les aires des triangles
  de peau sur 33 positions. C'est une vérification échantillonnée, pas une preuve
  mathématique de toute la trajectoire. Le trajet linéaire sans recalage préalable
  est également vérifié pour refuser de grands replis/effondrements de peau.
- Le même portrait complet et les mêmes sources brutes dans WebGL et Canvas 2D.
  Le moteur de secours respecte une géométrie fournie, même à 100 %.
- À 0 et 100 %, affichage direct des images canoniques A et B : pas de correction
  de lumière ni de maintien de la pose/identité de A à l'arrivée. Le contrôle
  de lumière est donc désactivé dans ce premier prototype.
- Diagnostic et animation utilisables dans le nouveau mode ; les vues neutres
  utilisent également les sources brutes correspondantes.

## Vérification observée dans Chrome

Les deux portraits de démonstration déjà publics du dépôt représentent deux
personnes différentes, l'une neutre et l'autre souriante. Test à 384 × 384 pixels,
avec le vrai moteur WebGL et le vrai moteur Canvas 2D, sur le même ordinateur.

| Contrôle | Résultat observé |
| --- | --- |
| Images à 0 et 100 % | Écart maximal de **0** avec les sources canoniques redimensionnées de la même façon |
| Comparaison WebGL/Canvas à 0,1 / 25 / 50 / 75 / 99,9 % | Écart moyen RGBA inférieur à **0,09/255**, écart maximal **11/255** |
| Proximité des extrémités, 0 → 0,1 % et 99,9 → 100 % | Écart moyen inférieur à **0,08/255**, maximum **4/255** |
| Parcours inverse B → A, aux trois positions intermédiaires | Maximum **1/255** ; image centrale identique |
| Topologie MediaPipe | 852 triangles de peau, complétés par les ouvertures ordonnées |
| Trajet linéaire de la paire publique | Fraction pondérée de triangles inversés ≈ 0,000674 ; effondrés ≈ 0,000133 |

Le garde-fou atténue fortement MLS sur cette paire : intensité effective
**0,00546875** pour une demande de 0,35. Le prototype ne démontre donc pas encore
un gain visuel important attribuable à MLS. L'inspection des cinq étapes montre
une évolution de l'ensemble du visage ; des images fantômes restent visibles
dans les cheveux et certains détails. Les mesures numériques ci-dessus ne sont
pas un score de naturel ou de fidélité anatomique.

Le dernier garde-fou sur la trajectoire sans recalage a également été vérifié
numériquement avec cette même topologie issue de `@mediapipe/tasks-vision@0.10.35`.
La comparaison graphique a été observée avant son ajout ; il ne modifie pas les
pixels d'une paire acceptée et cette paire est acceptée.

## Reproduire le contrôle graphique

Depuis la racine du dépôt :

```sh
node tests/browser/generate-full-morph-qa.mjs
python3 -m http.server 8787 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8787/work/full-morph-qa.html`. La page de test est générée
à partir du code actuel de l'application et des seuls portraits publics de
démonstration. Elle vérifie les extrémités, compare les moteurs et les parcours,
et affiche les cinq étapes ainsi que les mesures. Elle dépend du chargement des
modèles MediaPipe comme l'application. Elle n'accède à aucun scan de l'utilisateur.
Le résultat graphique n'est pas exécuté par la CI Node.

## Tests et limites

`npm test` : **94 tests réussis** localement, dont douze nouveaux tests sur MLS,
les ouvertures, les extrémités, les sources, le parcours inverse, la validation du
trajet et l'intégration aux moteurs. Les tests statiques existants ont été mis à
jour pour le nouveau mode par défaut et le cache de textures explicite.

Ce jalon ne valide pas encore deux personnes différentes avec des expressions
extrêmes telles que bouche complètement fermée contre très grande ouverture.
Il manque le traitement de visibilité des surfaces nouvellement visibles,
la sélection de textures d'intérieur de bouche, la fusion multirésolution et
le guidage 3D de la pose. La paire privée et Safari iPhone n'ont pas été testés
avec ce nouveau moteur. Aucun scan, photo ou repère privé n'est ajouté.
