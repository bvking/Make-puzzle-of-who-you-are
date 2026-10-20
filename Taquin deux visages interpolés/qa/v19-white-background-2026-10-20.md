# V19 — sources détourées sur un fond blanc commun

Validation locale du 20 octobre 2026, Chrome sur cet ordinateur.
Les mesures jointes concernent exclusivement les portraits publics du dépôt.
Aucun scan, photo, repère ni rendu privé n'est publié.

## Changement

Toutes les sources de morphing sont maintenant préparées sur blanc opaque.
Le modèle multiclasses conserve le visage, les cheveux et les accessoires près
de la tête, puis un contrôle de connexion retire les fragments isolés. L'ovale
du visage reste opaque pour protéger les yeux, lunettes et cavités buccales.
Le bord est adouci vers l'intérieur. Le cou, les vêtements et le décor sont
exclus. Un repli sur l'ovale du visage est annoncé si le modèle échoue.

Les archives possédant déjà un contour de tête ne contournent pas ce traitement.
Les sources détourées alimentent tous les modes. Les images recadrées originales
restent séparées et sont réutilisées à l'export de l'archive privée. Le chargement
de modèles n'envoie pas les photos au fournisseur du modèle.

À 0 et 100 %, l'exactitude est mesurée sur les portraits préparés sur blanc,
sans nouvelle correction de lumière. L'harmonisation des anciens modes est
bornée par le masque pour ne pas recolorer le fond blanc.

La justification figure dans [MORPHING_METHODS.md](../../MORPHING_METHODS.md).

## Vérifications automatisées et navigateur

`npm test` : **146 tests réussis** localement. Les nouveaux tests couvrent les
classes de segmentation, les trous du modèle dans le visage, les fragments
isolés, l'absence de modèle, l'alpha et le blanc exact, l'adaptateur réel de
préparation, l'annulation d'une paire en cours, les anciens contours archivés,
l'export des originaux et la correction lumineuse limitée au masque.

Pour reproduire le banc public : exécuter
`node tests/browser/generate-full-morph-qa.mjs`, servir le dépôt sur localhost,
puis ouvrir `work/full-morph-qa.html`. Les cinq positions 0/25/50/75/100 %,
les positions proches des extrémités et le parcours inverse sont contrôlés.
Les quatre coins de chaque image sont mesurés sur des carrés de 12 × 12 pixels.

| Cas public | Extrémités : erreur max | Fond blanc : écart max | Canvas–WebGL : moyenne/max (0–255) | Inversion : erreur max |
| --- | ---: | ---: | ---: | ---: |
| Natif | 0 | 0 | 0,079 / 9 | 1 |
| B à 78 %, rotation 8° | 0 | 0 | 0,060 / 29 | 1 |
| Affine légère | 0 | 0 | 0,071 / 17 | 1 |

**Les trois cas passent**, sans modifier les seuils historiques. Aucune sélection
de texture ne déborde des cavités. Les mesures brutes sont disponibles dans
[le JSON public](v19-public-white-metrics-2026-10-20.json). Ce banc est exécuté
manuellement dans Chrome ; il est distinct de la CI Node. Les transformations
synthétiques portent sur le cadrage 2D, pas sur une vraie perspective 3D.

## Vérifications privées, conservées uniquement en local

Deux jeux de scans fournis ont été importés via l'interface, préparés avec la
segmentation et comparés aux sources brutes à géométrie identique. Le retrait
du décor et des vêtements supprime leurs superpositions. Les fonds testés sont
blancs et les extrémités préparées exactes. Les fichiers de comparaison, les
mesures et animations restent sur l'ordinateur, hors des fichiers suivis.

Un jeu passe 30/30 contrôles ; l'autre 27/30. Ses trois échecs sont les maxima
ponctuels Canvas–WebGL, malgré de faibles écarts moyens. Les seuils ne sont pas
assouplis pour les faire passer. Les différences de rasterisation des bords
Canvas et GPU sont une explication probable, à confirmer par une analyse
spatiale. Ces essais sur une même identité avec des expressions différentes
ne valident pas l'objectif final à eux seuls.

## Limites observées

Les cheveux peuvent encore présenter des liserés, des mèches dédoublées ou des
contours tronqués ; les oreilles peuvent être coupées par le masque. Le flou et
des superpositions internes autour de la bouche et du front persistent sur
certains scans. Le détourage ne remplace pas la correspondance de ces textures.
Il n'ajoute ni reconstruction 3D, ni surfaces cachées, ni décontamination des
couleurs déjà mélangées au décor dans les cheveux fins. Safari/iPhone reste à
tester. Les invariants numériques ne constituent pas un score de naturel.
