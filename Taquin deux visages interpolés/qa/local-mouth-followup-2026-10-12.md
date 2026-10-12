# Morphing « Expressions locales » — bouche (12 octobre 2026)

## Constat sur les captures iPhone
La bouche n'est pas entièrement figée : les images diagnostiques à 25 %, 50 % et 75 % montrent une augmentation visible de son ouverture. En revanche, la région animée est découpée trop étroitement ; la bouche peut paraître superposée à une mâchoire figée, ce qui affaiblit l'effet de morphing.

## Cause technique plausible
La précédente fonction `localMaskFeatures(points)` ne regardait que les positions interpolées courantes. L'ellipse labiale pouvait ainsi ne pas couvrir les lèvres des deux extrémités A et B, tandis que le menton restait presque entièrement pris dans le fond fixe A.

## Correction expérimentale
- Conserver la géométrie robuste `stabilizedGeometry` (recalage des deux vues).
- Faire calculer le masque labial avec les trois groupes de repères : image interpolée, référence A, B recalée.
- Ajouter une zone de raccord progressif sur le bas du visage, d'opacité inférieure à celle des lèvres.
- Protéger toujours les yeux, le front, les cheveux, les lunettes et le décor lorsque l'option correspondante est activée.
- Ne pas ajouter les images de visages au dépôt GitHub.

## Vérifications et limites
Les vérifications géométriques synthétiques établissent que l'enveloppe couvre une bouche B plus ouverte, que le raccord de mâchoire reste moins intense que la bouche, que les yeux demeurent protégés par défaut et qu'un repère absent invalide le masque. Le fichier de tests unitaires a été étendu.

Ces contrôles ne remplacent pas les tests Safari iPhone : il reste à comparer visuellement les 6 positions, en vérifiant notamment la continuité entre les lèvres, le menton et les joues. Les captures disponibles sont des **screenshots de résultats** et non les photographies sources brutes ; elles ne suffisent pas à reconstituer la paire de scans exacte.

## Conservation des données
Les captures ont été sauvegardées de manière privée dans la bibliothèque ChatGPT, dossier `Morphing facial`, archive `diagnostics-2026-10-12.zip`. Elles ne sont pas dans ce dépôt public. Pour un vrai banc de régression automatique, il faudra exporter les photos sources A et B et leurs repères MediaPipe avec l'accord du propriétaire, dans un stockage privé.
