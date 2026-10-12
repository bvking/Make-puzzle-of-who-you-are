# V16 expérimentale — expressions locales (12 octobre 2026)

**Branche GitHub :** `morph-local-expressions-2026-10-12`. Référence conservée : `morph-robust-handheld-2026-10-10`.

## Problème documenté

Les captures iPhone transmises montrent une transition du sourire à 25 %, 50 % et 75 %, mais aussi des images fantômes sur le haut du visage, les lunettes et les contours externes. La simple correction globale de translation/rotation/échelle ne supprime pas ces objets doubles.

## Modification concrète

- Nouveau mode **« Expressions locales »**, sélectionné après une paire de scans utilisable. Les modes « Visage stabilisé », « Triangles WebGL », « Triangles 2D » et « Régions » restent accessibles sans refaire les captures.
- Les photographies et repères sources ne sont pas modifiés. Le nouveau mode réutilise `stabilizedGeometry(v)`, le recalage robuste eyes/bridge/nose et le moteur triangulaire WebGL (Canvas 2D en secours).
- Le résultat est *composé* sur la photo A intacte. Le mode local calcule un masque alpha doux à partir des repères de bouche, du menton, du nez, et éventuellement des yeux. La bouche est prioritaire (opacité centrale élevée), le nez reste discret et la périphérie de la tête, les cheveux, les vêtements et le décor proviennent de A.
- Case **« Garder les lunettes, les sourcils et le haut du visage de la photo A »** cochée par défaut. Quand elle est cochée, aucune zone dédiée aux yeux n'est intégrée au masque, ce qui protège mieux les branches de lunettes et les sourcils. Ce n'est **pas** une détection automatique d'objets : certaines sections proches du nez peuvent encore changer.
- Quand la case est décochée, l'interpolation des deux régions oculaires reprend avec une opacité modérée, au risque d'apparition de doubles montures si les deux photos comportent des lunettes.
- Le diagnostic 25/50/75 affiche le moteur du mode choisi, et le mode local peut être directement comparé au précédent « Visage stabilisé ». La comparaison de fond neutre ne sert pas dans ces deux modes, puisqu'ils figent déjà le décor.

## Compromis visuels

Il ne s'agit pas d'un morphing intégral du visage. **La majeure partie du haut et du contour conserve l'identité et la texture de A à tous les pourcentages**, y compris à 100 %. Cela vise la propreté des transitions d'expression dans les mauvaises captations, et non la reproduction complète du visage B à la fin. La fusion des dents/lèvres au centre peut rester floue si les prises de vue ou l'occlusion de la bouche divergent fortement. Une segmentation sémantique réelle, l'analyse des surfaces occultées et un suivi d'objets rigides seraient nécessaires pour un rendu général plus avancé.

## Tests

- `tests/local-expression.test.mjs` : choix des zones, protection lunettes activée/désactivée, repères manquants, absence de mutation des repères, intégration au moteur triangulaire, animation.
- Tests des versions précédentes mis à jour lorsque leur assertion sur l'ancien mode par défaut n'était plus valide.
- Workflow `npm test` déclenché par les pushes sur cette branche.

L'apparence sur Safari iPhone, les performances réelles et les scans ayant produit les captures ne sont pas accessibles directement depuis GitHub et n'ont pas encore été validés sur le vrai navigateur. Une capture d'écran d'un rendu ne permet pas de reconstituer les deux photos originales avec leurs 478 landmarks pour automatiser un test visuel équivalent.

## Validation demandée

Ouvrir le lien de la branche sur l'iPhone ; effectuer une paire de scans, sélectionner « Expressions locales » et capturer les trois résultats à 25/50/75. **Avec cette même paire**, sélectionner « Visage stabilisé » et capturer les mêmes pourcentages, puis éventuellement décocher la protection des lunettes dans « Expressions locales » pour observer la différence. Comparer séparément la bouche, les yeux, les montures, le front et les bords du masque. En cas d'amélioration insuffisante, laisser intactes les versions précédentes.
