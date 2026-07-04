# Make puzzle - travail depuis iPhone via GitHub


Ce dossier contient la copie de travail des fichiers envoyes depuis l'iPhone.

Fichiers principaux :
- `index_iphone.html` : entree recommandee pour tester avec les fichiers separes.
- `index.html` : entree desktop/simple.
- `Sqaure Mode preset.js` : sketch principal utilise par les pages HTML.
- `Square_mode_champMixteAgent2juin.js` : autre version/source du sketch.
- `Make puzzle iPhone autonome.html` : version tout-en-un avec p5.js, dat.GUI, images et presets integres.
- `visage_femme.png` et `visage_homme.png` : images sources.
- `PROMPT_CHATGPT_IPHONE.md` : contexte de developpement a recoller si necessaire.

## Ce que Codex peut faire depuis l'iPhone

Depuis l'app ChatGPT sur iPhone, Codex peut piloter un hote Codex sur Mac ou Windows, mais cet ordinateur doit rester allume, connecte, et signe dans le meme compte. Dans ce mode, l'iPhone sert de telecommande du projet qui vit sur l'ordinateur.

Pour travailler sans ordinateur allume, il faut que le projet soit dans un endroit accessible a Codex cloud/web, typiquement un depot GitHub. Ensuite, depuis l'iPhone, ouvrir ChatGPT/Codex web et demander a Codex de modifier le depot.

## Methode recommandee sans Mac allume

1. Creer un depot GitHub pour ce projet.
2. Y ajouter tous les fichiers de ce dossier.
3. Activer GitHub Pages, Netlify, Vercel ou un autre hebergement statique pour tester le rendu dans Safari iPhone.
4. Depuis l'iPhone, ouvrir ChatGPT > Codex, selectionner le depot GitHub, puis demander les modifications.

## Methode locale iPhone

Il est possible de stocker ce dossier dans iCloud Drive ou dans l'app Fichiers de l'iPhone. C'est utile pour conserver les fichiers, mais ce n'est pas suffisant pour que Codex modifie directement le dossier comme sur un ordinateur.

Pour lancer le programme directement sur iPhone sans serveur, essayer d'ouvrir `Make puzzle iPhone autonome.html`. Selon iOS/Safari, le JavaScript local peut etre limite. Pour un fonctionnement fiable, preferer un hebergement web statique.
