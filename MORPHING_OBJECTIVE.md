# Mission pour l'IA chargée du développement du morphing

Date de clarification : 18 octobre 2026. Fond blanc précisé le 20 octobre 2026.

Nouvelle direction demandée le 20 octobre : reconstruire un visage de synthèse
en 3D à partir de chaque source, puis faire le morphing des formes et expressions
dans cet espace avant de projeter les textures. Le jalon V20 est une surface
faciale ouverte à profondeur estimée, examinable en argile et sous petite
rotation. Il ne constitue pas encore une tête 3D complète ni un scan métrique.

## But final

Développer un morphing complet entre **deux personnes différentes, A et B,
ayant des expressions éventuellement totalement différentes**. Le programme
doit transformer progressivement l'identité, la forme et l'expression du visage
A vers celles du visage B. Il doit fonctionner avec les photos ou scans
multivues fournis par l'utilisateur dans le navigateur, notamment sur iPhone.

Exemple central à réussir : une personne A, bouche fermée et expression neutre,
devient une autre personne B, bouche largement ouverte ou faisant une grimace.
Le cas inverse doit également fonctionner.

Le transfert d'expression sur une identité conservée et l'animation de la bouche
d'une seule personne ne constituent pas l'objectif final. Ils peuvent servir de
cas secondaires de contrôle.

## Résultat attendu

- Détourer systématiquement les deux visages sur un fond blanc opaque identique
  avant le morphing, y compris lors de la réimportation d'anciens scans.
- À 0 %, retrouver exactement le portrait A préparé sur blanc.
- À 100 %, retrouver exactement le portrait B préparé sur blanc.
- Entre les deux, faire évoluer ensemble les yeux, sourcils, nez, lèvres,
  joues, mâchoire, menton et contour du visage. La texture, les volumes apparents
  et l'expression doivent suivre une trajectoire cohérente.
- Conserver une continuité temporelle près des extrémités et lors des grandes
  ouvertures/fermetures de bouche. Un changement de texture ne doit pas produire
  de saut, ni un changement de moteur faire apparaître une autre géométrie.
- Éviter les bouches rapportées, doubles lèvres, dents fantômes, joues figées,
  plis artificiels, coutures et déformations incohérentes des traits.
- Faire évoluer aussi le haut du visage vers B. Les lunettes peuvent demander
  un traitement spécifique, mais leur protection ne doit pas conserver les yeux
  ou le front de A à 100 %. Des lunettes présentes seulement dans A ne doivent
  pas subsister dans le résultat B.

L'exactitude des extrémités se mesure sur les deux images canoniques réellement
utilisées : recadrage, orientation et détourage sur blanc identifiés. Une comparaison à l'original
pleine définition doit tenir compte de ce prétraitement. Toute harmonisation
temporaire doit respecter ces extrémités.

Pour le prototype Surface 3D, les extrémités sont les surfaces reconstruites de
A et B : vérifier leurs repères projetés et leur profondeur. L'argile sert à
examiner le volume sans texture. Ne pas ajouter les photos originales en fond
pour masquer une reconstruction manquante. Le contrat des portraits exacts sur
blanc reste vérifié séparément dans le mode Morphing complet.

Le décor, les vêtements et le cou sont retirés avant la déformation. Le visage
et les cheveux retenus doivent évoluer continûment avec le cadrage, sans contour
de A laissé sous le visage B. Le détourage préserve les yeux, les lunettes et
l'intérieur de bouche ; un modèle indisponible déclenche un contour facial de
secours annoncé. Les originaux restent disponibles pour l'archive privée.

## Échelle, pose, lumière et données manquantes

Corriger les différences d'échelle, d'inclinaison, de cadrage et de lumière.
Exploiter les scans multivues pour choisir les vues compatibles et les textures
réellement observées. Une sélection de vues proches peut constituer un premier
jalon ; elle ne valide pas à elle seule les perspectives très différentes.

Avec seulement deux photos, certaines surfaces, dents ou parties du visage sont
invisibles dans les sources. Ne pas promettre leur reconstruction exacte.
Identifier les limites et distinguer les pixels observés des éventuels pixels
synthétisés. Ne pas remplacer discrètement l'objectif par des expressions ou des
poses presque identiques pour obtenir une validation plus facile.

## Situation de départ à corriger

La branche de travail est `feat/adaptive-chin-transition-20261014`.
Le mode expérimental « Expressions locales » conserve une grande partie de A
et superpose des régions déformées avec des masques transparents. Il sert de
comparaison historique ; il ne satisfait pas le contrat de morphing complet.
Le prochain moteur doit être évalué sur le changement d'identité et d'expression,
sans figer durablement le haut du visage de A.

Lire ensuite [les méthodes retenues et leur justification](MORPHING_METHODS.md).
Ce document décrit un travail à réaliser, pas un résultat déjà obtenu.

## Critères de validation

1. Établir une matrice de paires de personnes différentes : neutre/sourire,
   bouche fermée/grande ouverture, sourire/grimace, yeux ouverts/fermés,
   morphologies différentes et lunettes présentes dans une seule image.
2. Contrôler 0/25/50/75/100 %, des positions proches de 0 et 100 %, l'animation
   complète et le parcours inverse B vers A. Vérifier les extrémités par pixels
   et la qualité intermédiaire par inspection des visages à taille utile.
3. Examiner séparément les lèvres, l'intérieur de bouche, les joues, le menton,
   les yeux, les lunettes et le contour. Comparer les moteurs WebGL et Canvas 2D
   sur les mêmes entrées et les mêmes positions.
4. Tester les changements de pose/lumière et mesurer les performances sur
   Chrome puis Safari iPhone. Distinguer tests synthétiques, portraits publics
   autorisés, captures privées et vérifications sur appareil réel.
5. Rapporter séparément stabilité du maillage et qualité visuelle. Un score
   géométrique élevé, des images distinctes à 25/50/75 % ou une suite de tests
   réussie ne prouvent pas un morphing naturel.

## Contraintes de travail

- Ne jamais publier de scans, portraits, archives ou repères faciaux privés,
  y compris dans les tests, captures d'écran, journaux ou artefacts de CI.
  Les requêtes de recherche et les commentaires GitHub ne doivent pas les contenir.
- Garder les calculs sur les captures privées dans le navigateur/localement.
  Toute proposition de service externe doit expliciter ses transferts de données.
- Créer des commits séparés par évolution logique, vérifier le résultat, pousser
  sur la branche expérimentale et communiquer les SHA et résultats des tests.
- Ne pas fusionner dans `main` sans demande explicite de l'utilisateur.
- Ne jamais présenter une méthode proposée ou un prototype comme visuellement
  validé avant les comparaisons requises ci-dessus.
