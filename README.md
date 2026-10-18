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
de développement ; ces méthodes ne sont pas encore intégrées au moteur final.

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
