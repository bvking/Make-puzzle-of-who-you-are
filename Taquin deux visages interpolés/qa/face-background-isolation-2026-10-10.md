# Diagnostic V16 — morphing du visage avec et sans décor

Date : 10 octobre 2026. Branche expérimentale : `morph-face-isolation-2026-10-10`.

## But

Déterminer si les doubles contours observés dans le morphing iPhone à 50 % et 75 % proviennent principalement du décor de rue ou des déformations du visage. Les captures précédentes comportaient un arrière-plan complexe (bâtiments, transports) ; elles ne permettent pas seules d'attribuer une cause.

## Mode de test

Après deux scans du même visage avec expressions différentes :

1. Sur l'écran de morphing, choisir **Triangles WebGL**.
2. Appuyer sur **Ouvrir le diagnostic 25 / 50 / 75 %** (gros bouton en haut).
3. Cocher **Comparer aussi le visage sur fond neutre** (coché par défaut).
4. Capturer en une seule fois les deux rangées **A – morphing complet** et **B – visage isolé/fond neutre**, chacune à 25/50/75 %. Transmettre également le texte de diagnostic. 
5. Recommencer en **Triangles 2D** si WebGL échoue et conserver la mention du moteur utilisée.

Les deux rangées proviennent des **mêmes photographies**, de la **même topologie triangulaire** et des **mêmes fractions 0.25/0.50/0.75**. La neutralisation est faite **avant** le warping, dans les textures sources : chacune conserve approximativement la tête et les cheveux en remplaçant le dehors par le même gris foncé. Les photos d'origine demeurent inchangées dans l'application.

## Interprétation

- Si les doubles contours disparaissent surtout dans le fond neutre alors que les traits du visage évoluent correctement, le décor / la couronne tête–fond contribue fortement au défaut.
- Si yeux, bouche ou contours faciaux doublent encore en fond neutre, le problème géométrique (correspondance des landmarks, occlusions, triangles) reste interne au visage.
- Si seuls les bords du masque présentent une découpe nette, cela peut être un **artefact ajouté par ce diagnostic**, non une erreur démontrée du morphing.
- Si le rendu « WebGL » est basculé en Canvas, le diagnostic le dit ; ne pas conclure sur le GPU WebGL dans ce cas.

## Limites techniques et vérifications

Le contour de tête est approximatif, basé sur le ring de silhouette calculé par le pipeline ou sa géométrie de secours. Cela **n'est pas** un détourage cheveux/peau au pixel près. Pour les perspectives éloignées ou les cheveux ébouriffés, ce contour peut retrancher des détails.

Les rendus intermédiaires passent par `renderSelected` et `renderWebGLMorph` ou `renderCanvasMorph`. Les textures WebGL sont explicitement rechargées si des sources temporaires sont fournies ; le cache reprend le mode normal sur le rendu suivant. Les sources temporaires ne sont pas attribuées à `state.photos`.

Tests de logique et de câblage : `tests/morph-isolation.test.mjs`, `tests/morph-diagnostic.test.mjs` et tests statiques existants. Contrôles ponctuels effectués avec moteurs simulés, et analyseur JavaScript. **Aucune exécution des modèles MediaPipe / moteur GPU Safari avec les scans réels n'est encore validée** à la rédaction de cette note. Le résultat doit être examiné sur iPhone avant toute fusion dans une version stable.
