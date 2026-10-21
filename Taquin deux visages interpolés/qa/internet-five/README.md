# Essais publics : cinq visages, dix paires

Essais du 21 octobre 2026, moteur V20 du commit `332f90c46bb5db9ebcb67829d409baabade1cb4d`, Chrome sur macOS. [Ouvrir la galerie](index.html). Les photographies proviennent de Wikimedia Commons ; leurs auteurs, sources et licences figurent dans [ATTRIBUTION.md](ATTRIBUTION.md). Aucun scan privé ne fait partie de ce jeu.

## Résultat

**Résultat partiel : cinq photos importées, neuf paires rendues sur dix, 163 contrôles techniques réussis sur 163 exécutés.** La dixième paire est refusée avant rendu. Ce nombre ne mesure pas le naturel des visages et ne constitue pas un taux de réussite esthétique de 90 %.

Les cinq entrées couvrent une bouche fermée, un sourire avec dents visibles, un rire bouche ouverte, des sourcils rapprochés avec lunettes et des paupières fermées. Le dernier portrait ajoute une forte différence de pose : le banc ne sépare donc pas parfaitement l'effet de l'expression de celui de la perspective.

Chaque photo passe par le véritable import de l'application : détection CPU IMAGE, recadrage du visage, nouvelle analyse, contrôle de capture et détourage sur blanc. Les cinq détourages utilisent la segmentation de tête, sans repli sur l'ovale. La surface 3D rend seulement la zone faciale : elle ne couvre pas toute la coiffure du détourage.

## Lecture visuelle des dix paires

Ces observations sont qualitatives, sur des rendus de 192 px et une animation de 256 px. Elles ne garantissent pas la qualité à grande résolution.

| Paire | Décision du moteur | Observation |
| --- | --- | --- |
| Bouche fermée → sourire avec dents | Rendue | Parmi les plus convaincantes : proportions stables, ouverture progressive ; texture un peu lissée au milieu. |
| Bouche fermée → rire | Rendue | Grande variation de bouche sans double contour global ; dents comprimées aux ouvertures intermédiaires. |
| Bouche fermée → sourcils rapprochés/lunettes | Rendue | Forme stable, mais monture translucide pendant la transition. |
| Bouche fermée → paupières fermées | Rendue | Expression transmise, avec forte inclinaison et aspect de masque tourné. Proche de la limite de replis. |
| Sourire avec dents → rire | Rendue | Bonne continuité de la forme du sourire ; dentition fusionnée au milieu. |
| Sourire avec dents → sourcils rapprochés/lunettes | Rendue | Bouche refermée progressivement ; mélange visible des lunettes et des sourcils. |
| Sourire avec dents → paupières fermées | Rendue | Expression lisible ; mélange visible des paupières, du maquillage et de l'éclairage. |
| Rire → sourcils rapprochés/lunettes | Rendue | Volumes cohérents ; dents, lèvres et lunettes cumulent les défauts de texture. |
| Rire → paupières fermées | **Refusée** | Replis du maillage. Le diagnostic indépendant de projection 3D atteint 5,12 % de surface retournée, au-dessus du seuil de 4 % ; aucun rendu hors garde n'est présenté comme valide. |
| Sourcils rapprochés/lunettes → paupières fermées | Rendue | Parmi les moins naturelles : disparition des lunettes sur les yeux qui se ferment et forte variation de pose. Proche de la limite de replis. |

Le fond blanc et la silhouette commune évitent ici la superposition de deux têtes entières. L'argile montre une évolution cohérente du nez, des joues et du menton. Elle révèle aussi une surface ouverte, des paupières peu détaillées et l'absence de globes oculaires et de dentition en volume. La rotation à 20°/10° révèle la coupe du front/des tempes et des bandes de texture sur certains bords latéraux.

Deux paires acceptées restent très proches du seuil de replis de 4 % : bouche fermée → paupières fermées (3,968 %) et lunettes → paupières fermées (3,991 %). Leur acceptation technique ne doit pas masquer ces limites.

## Ce que les contrôles vérifient

Pour chaque paire acceptée : cinq positions (0, 25, 50, 75 et 100 %) dans chacune des deux matières ; géométrie finie, normales unitaires, profondeur non nulle, extrémités XY conservées, images opaques et coins blancs ; différence entre argile et photos ; rotation à 20°/10° ; six comparaisons du parcours inverse. Un contrôle global vérifie que le tampon de profondeur WebGL résout effectivement l'occultation indépendamment de l'ordre des triangles.

Les gardes de capture, de compatibilité et de trajectoire sont celles de l'application. Aucun seuil n'a été relâché pour ce banc. Les résultats détaillés et la raison du refus sont conservés dans [results/metrics.json](results/metrics.json). Les repères publics figés servent aussi aux tests Node ; ils ne remplacent pas la détection réelle dans Chrome.

Les **182 tests Node passent**, dont 12 nouveaux tests sur les cinq sources publiques : provenance des photos, topologie de production et propriétés numériques des dix paires à 33 positions, de face et en rotation. Ces tests numériques ne valident pas l'acceptation des dix paires par l'application : le résultat du navigateur reste neuf sur dix. Les constantes de topologie MediaPipe 0.10.35 conservent leur provenance et leur licence Apache 2.0 dans les fichiers voisins.

L'animation présente la première paire acceptée contenant `open-laugh` (bouche fermée → rire), choisie avant évaluation esthétique. Ses 61 images aller sont de véritables rendus 3D. Le GIF ajoute le retour, soit 120 images, une palette globale, un fond blanc exact et une boucle de 6,8 secondes. Il ne crée aucune image intermédiaire par interpolation vidéo.

## Conclusion et suites retenues

La géométrie commune progresse ; les limites dominantes sont désormais les accessoires et les détails internes des textures. Les prochains développements doivent traiter les lunettes comme une couche distincte, représenter les yeux et la dentition séparément de la peau, puis harmoniser l'éclairage et améliorer les bords latéraux. Cette séance ajoute un banc reproductible et documente les échecs ; elle ne modifie pas le moteur pour masquer les défauts observés.

## Reproduire

Depuis la racine du dépôt :

```sh
npm test
node tests/browser/generate-five-portrait-qa.mjs
python3 -m http.server 8787 --bind 127.0.0.1
```

Ouvrir ensuite `http://127.0.0.1:8787/work/five-portrait-qa.html` dans Chrome avec WebGL. Le détecteur et la segmentation utilisent les dépendances distantes habituelles de l'application. Attendre le statut final après les dix paires et les atlas ; les boutons exportent les mesures, les repères, les détourages, les planches et les atlas. La page générée reste ignorée par Git. Les dimensions et SHA-256 des fichiers d'entrée figurent dans [manifest.json](manifest.json).

Pour encoder un atlas téléchargé, avec Python, Pillow et NumPy disponibles :

```sh
python3 tests/browser/encode-five-portrait-animation.py --atlas /chemin/atlas-photos.png --output /chemin/morph-photos.gif
```

Ce script concerne exclusivement les atlas de la paire publique bouche fermée → rire sélectionnée par ce banc ; il incorpore les crédits correspondants dans le commentaire GIF et vérifie les 120 images, leur durée et la palette commune.

Les planches, animations et adaptations photographiques de ce dossier sont sous CC BY-SA 4.0, avec les crédits indiqués dans ATTRIBUTION.md ; la licence du logiciel reste distincte.
