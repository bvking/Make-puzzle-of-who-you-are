# V16 expérimentale — correction automatique des captures iPhone tenues à la main

**Branche :** `morph-robust-handheld-2026-10-10` (sans modification de `browser-morph-v16` ni de `main`).  
**Date :** 10 octobre 2026.

## Constat tiré des captures utilisateur

Les trois images du diagnostic « visage isolé » à 25 %, 50 % et 75 % montrent une transformation réelle de la bouche, mais un contour de découpe approximatif et des arrière-plans restant visibles près des cheveux. Les scans pris à main levée présentent aussi des différences de cadrage et de perspective. La qualité de la morphologie interne (yeux, nez, bouche) est plus prometteuse que celle des couronnes tête/décor, mais ces captures ne prouvent pas que toute déformation interne soit corrigée.

## Ce qui est réellement codé

1. **Nouveau mode « Visage stabilisé »** (sélectionné par défaut après une première paire exploitable). Les modes historiques WebGL, Canvas 2D et Régions restent disponibles.
2. **Estimation B → A par ancrages stables** avec `handheld-alignment.mjs` : coins des yeux, arête du nez, points centraux du nez ; pas de bouche, de lèvres ou de menton dans l'estimation globale. Ajustement de similarité 2D (translation, rotation, échelle), hypothèses leave-one-out, puis repondération robuste. Un point de détection aberrant ne doit pas entraîner tout le portrait.
3. **Correspondance géométrique** : les coordonnées UV de la photo B restent celles de la vraie photo ; les points *de destination* de B sont corrigés par la transformation robuste vers A avant l'interpolation du maillage facial. **Pas de simple superposition CSS, ni de déplacement des seuls points sans la texture.**
4. **Géométrie expressive conservée** : le mouvement de la bouche suit les landmarks alignés ; le contour externe du visage est légèrement contraint pour limiter son errance. Topologie faciale évaluée ; si le maillage est trop instable, ne pas prétendre que le résultat est valide.
5. **Arrière-plan de A figé** et morphing local du visage via un masque ovale à bord adouci. Cheveux, vêtements et décor ne participent plus au morphing *dans ce mode*. L'identité visuelle de la photo A au pourcentage 0 % est préservée ; à 100 %, c'est le **visage B recalé dans la scène de A** et non la photo B entière.
6. **Diagnostic 25/50/75** conservé et compatible avec le mode stabilisé. La comparaison supplémentaire « fond neutre » est désactivée dans ce mode car le décor est déjà fixe. Les anciens modes restent disponibles pour comparer avec et sans neutralisation du décor.

## Limites

Une transformation affine 2D ne peut pas reconstruire une joue cachée, un œil occulté, des dents absentes ou une véritable nouvelle perspective 3D. Le mode vise les erreurs courantes de capture à main levée : déplacement, zoom apparent et inclinaison de la caméra, et n'offre qu'une correction limitée des rotations de tête. Il ne remplace pas un modèle de reconstruction faciale 3D pour des vues très différentes. Le masque de contour reste approximatif : il peut être visible près des joues, oreilles et mâchoires. Il faudra envisager un *matting* tête/cheveux plus précis si l'objectif artistique requiert la morphologie externe.

La compatibilité initiale des deux vues est encore évaluée par le pipeline existant. Un couple classé « inutilisable » peut encore être refusé avant ce nouveau rendu ; cette branche ne promet pas de réparer n'importe quelle paire.

## Vérifications effectuées

- Syntaxe du module et du JavaScript de la page vérifiée.
- Régression des assertions statiques, à l'exception du test séparé de hash historique qui doit être validé dans le workflow Node complet.
- Calculs numériques synthétiques : similitude connue retrouvée malgré des changements importants d'expression et une erreur isolée d'un repère du nez.
- Tests ajoutés : `tests/handheld-alignment.test.mjs`. CI configurée pour cette branche.

**Pas encore validé :** moteur MediaPipe sur les scans réels de la personne, rendu WebGL Safari/iPhone, performances FPS, résultat esthétique et reproductibilité entre identités différentes. Aucune certitude de « 99,9 % » ne peut être donnée avant une métrique validée et de véritables données de test.

## Test pratique demain

1. Ouvrir la page de la branche dans Safari (pas dans la vue web intégrée à ChatGPT).
2. Scanner le même visage avec expression neutre puis bouche ouverte, en tenant l'iPhone normalement. Il n'est pas nécessaire de retrouver exactement la même place, mais avoir au moins un angle frontal commun reste utile.
3. Au lieu de « Triangles WebGL », vérifier que le nouveau mode « Visage stabilisé » est actif.
4. Appuyer sur « Ouvrir le diagnostic 25 / 50 / 75 % » et conserver une capture des trois images, du message de diagnostic et des deux photographies sources.
5. Sélectionner aussi « Triangles WebGL » pour comparer la **même paire** à taux de morphing identiques, sans refaire les photos.
6. Documenter en priorité le contour des yeux, de la bouche et du nez ; noter séparément les découpes éventuelles à l'ovale.

Ne pas fusionner dans la branche principale sans confrontation visuelle réelle.
