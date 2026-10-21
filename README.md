# Make puzzle

## Prendre photo — 10 photos

Prendre 1 photo par seconde avec l’iPhone et les afficher.

## Morphing facial — état actuel

**Objectif de référence : deux personnes différentes avec des expressions
éventuellement totalement différentes, de A à 0 % à B à 100 %.**
La [mission de développement pour une autre IA](MORPHING_OBJECTIVE.md) précise
le résultat attendu, les critères de validation et les règles de confidentialité.
Le mode expérimental « Expressions locales » ne réalise pas encore cet objectif.
Le [choix des méthodes et sa justification](MORPHING_METHODS.md) définit l'ordre
de développement. Un premier mode **Morphing complet · nouveau** est maintenant
intégré : tous les traits et le contour évoluent vers B, avec des extrémités A/B
exactes. Le [bilan du premier jalon](Taquin%20deux%20visages%20interpol%C3%A9s/qa/full-face-engine-2026-10-18.md)
détaille les tests et les limites, notamment les expressions extrêmes encore
non validées entre deux identités différentes.

La V19 prépare systématiquement les deux têtes sur un **fond blanc opaque
commun** avant toute déformation. L'archive privée conserve les images recadrées
originales ; les extrémités du morphing correspondent aux portraits détourés.
Le [bilan V19](Taquin%20deux%20visages%20interpol%C3%A9s/qa/v19-white-background-2026-10-20.md)
décrit les contrôles et les défauts visuels encore présents.

La V20 ajoute **Surface 3D · prototype** : reconstruction d'une surface faciale
avec relief estimé, morphing des formes XYZ, aspect Argile pour examiner le
volume, puis Photos projetées. Les petites rotations permettent l'inspection.
Les cheveux, le crâne et les surfaces cachées ne sont pas reconstruits ; il ne
s'agit pas d'un scan 3D métrique. Le [bilan V20](Taquin%20deux%20visages%20interpol%C3%A9s/qa/v20-surface3d-2026-10-21.md)
sépare le fonctionnement 3D vérifié de la qualité visuelle encore expérimentale.

### Référence historique

La branche `browser-morph-v16` reste une version candidate. Le passage entre
deux expressions fonctionne avec des perspectives proches, mais des contours
dédoublés subsistent sur le cou et l’arrière-plan.

Le [bilan du 10 octobre 2026](Taquin%20deux%20visages%20interpol%C3%A9s/qa/morphing-status-2026-10-10.md)
décrit les observations, la portée réelle des 32 tests et les corrections à
faire avant une validation Safari/iPhone et une fusion dans `main`.


## Conserver et réutiliser les scans de morphing (branche expérimentale)

Après avoir capturé et validé les deux visages dans `v15-multiview.html`, cliquer sur
**Exporter les deux scans (.zip)** puis enregistrer le fichier dans **Fichiers** (iPhone)
ou le dossier local de son choix. Sur une version ultérieure, revenir au premier écran
et utiliser **Réutiliser deux scans depuis un ZIP privé**. La même paire de portraits,
les coordonnées MediaPipe et les contours calculés sont réutilisés : **aucune nouvelle
prise de vue n'est requise**.

L'archive contient `visage-A.jpg`, `visage-B.jpg` (deux images carrées **recadrées
à 768 × 768**, et non les photos d'origine pleine définition) et `scan.json` (468–478
repères par visage, poses et contours). Elle est générée et relue **localement dans le
navigateur** ; aucune photo ni coordonnée n'est envoyée sur GitHub. **Ne jamais déposer
cette archive dans un dépôt public**, puisqu'elle contient des données faciales personnelles.
L'utilisateur choisit où la conserver et avec qui la partager.

L'import prend en charge les ZIP créés par cette fonctionnalité (format v1, max. 12 Mo).
Il valide le format, le nombre de fichiers, les images JPEG, les repères et le CRC32.
Le moteur MediaPipe doit pouvoir être chargé pour reprendre le rendu. L'intégration iPhone
Safari, notamment le téléchargement via Fichiers, nécessite encore un essai réel.
