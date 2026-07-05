// ✅ Version enrichie – attracteurs ajustables + Bleu Perlin + GUI + sauvegarde _debut_300_agents
// + Phases demandées :
//   1) Œil ouvert révélé par densité (patchs comme au début)
//   2) Crossfade 2s (œil ouvert s'estompe, œil fermé apparaît)
//      → Ajout : pendant ces 120 frames, on alterne fond ouvert/fermé toutes les 30 frames
//   3) Œil fermé plein cadre (hold)
//   4) Redémarrage : même logique de révélation mais avec l'œil fermé
//   → Ajout : à la FIN de la transition, baisse progressive du nombre d’agents vers 300 sur 160 frames

// -------------------- ÉTAT & IMAGES --------------------
let gridSize = 20;
let cellSize;
let field = [];
let attractors = [];
let agents = [];
let selectedAttractor = null;
let fieldColor = [];
let densityMap = [];
let densityDuration = [];
let agentLayer;

let img; // oeil ouvert
let imgReady = false;

let imgClosed;            // oeil fermé
let imgClosedReady = false;
let closedRequested = false;

let openAlpha = 255;      // alpha patches oeil ouvert
let closedAlpha = 0;      // alpha fond oeil fermé pendant la transition
let transitionActive = false;
let transitionStartFrame = 0;
const transitionDurationFrames = 120; // ≈2s @60fps
const holdClosedFrames = 30;          // durée "plein cadre" œil fermé
let holdStartFrame = 0;

const maxClosedAlpha = 255;           // opacité fond pendant transition (utilisée avec tint)

// Phases d'exécution
// "open"       : révélation œil ouvert (comme au début)
// "transition" : crossfade en cours (avec flip 30 frames)
// "hold"       : œil fermé plein cadre (agents/attracteurs continuent)
// "relaunch"   : relance logique initiale mais avec l'œil fermé
let stage = "open";
let activePresetIndex = -1;
let guiVisible = true;
let isPaused = false;
let mobileControls = null;
let mobilePresetButton = null;
let mobilePauseButton = null;
let lastTouchInteractionAt = 0;

// --- Réduction progressive d'agents après transition ---
let agentReduceActive = false;
let agentReduceStartFrame = 0;
const agentReduceDuration = 160; // frames
const agentTargetCount = 300;
let agentReduceStartCount = 0;

// -------------------- BRUIT PERLIN ATTRACTEUR BLEU --------------------
let blueNX = Math.random() * 1000;
let blueNY = Math.random() * 2000;

// -------------------- PRESETS --------------------
// Recuperes depuis le localStorage Chrome de https://preview.p5js.org.
const DEFAULT_PRESETS = [
  {
    name: "champ",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 5.551287044877222, agentFollowStrength: 0.1258255715495343, agentRandomness: 0.47713801862828115, agentCount: 790, forceRouge: 0.8, forceVert: 0.8, forceBleu: 0.4, globalForce: 3.447078746824725, movementMode: "champ", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "attract", modeVert: "attract", modeBleu: "repulse", attractorRadius: 44, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: true, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 603.5625, y: 130.30078125, mode: "attract" }, { name: "Vert", x: 449.609375, y: 113.81640625, mode: "attract" }, { name: "Bleu", x: 108.09370763915965, y: 98.80181085294019, mode: "repulse" }]
  },
  {
    name: "attracteur",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 5.551287044877222, agentFollowStrength: 0.1258255715495343, agentRandomness: 0.47713801862828115, agentCount: 790, forceRouge: 0.2, forceVert: 0.9, forceBleu: 0.5, globalForce: 3.447078746824725, movementMode: "attracteurs", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "attract", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: false, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 781.06640625, y: 679.66015625, mode: "attract" }, { name: "Vert", x: 722.1640625, y: 321.2421875, mode: "attract" }, { name: "Bleu", x: 73.19479162368238, y: 61.823467924956844, mode: "repulse" }]
  },
  {
    name: "attracteur - seuil densite",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 5.551287044877222, agentFollowStrength: 0.1258255715495343, agentRandomness: 0.47713801862828115, agentCount: 790, forceRouge: 0.2, forceVert: 0.9, forceBleu: 0.5, globalForce: 3.447078746824725, movementMode: "attracteurs", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 19.60860159224645, modeRouge: "attract", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: false, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 781.06640625, y: 679.66015625, mode: "attract" }, { name: "Vert", x: 722.1640625, y: 321.2421875, mode: "attract" }, { name: "Bleu", x: 29.69145303008799, y: 57.74644750224703, mode: "repulse" }]
  },
  {
    name: "champ attracteur vert heat",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 5.551287044877222, agentFollowStrength: 0.1258255715495343, agentRandomness: 0.47713801862828115, agentCount: 790, forceRouge: 0.2, forceVert: 0.9, forceBleu: 0.5, globalForce: 3.447078746824725, movementMode: "champ", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "attract", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: true, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 781.06640625, y: 679.66015625, mode: "attract" }, { name: "Vert", x: 739.16015625, y: 105.1484375, mode: "attract" }, { name: "Bleu", x: 37.13757468656096, y: 22, mode: "repulse" }]
  },
  {
    name: "mixte_suivi chanp_ alea+ nombre 850",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 2.3813862928348914, agentFollowStrength: 0.08428521979923849, agentRandomness: 0.48762547594323297, agentCount: 910, forceRouge: 0.5, forceVert: 0.5, forceBleu: 0.5, globalForce: 3.447078746824725, movementMode: "mixte", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "attract", modeVert: "attract", modeBleu: "attract", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: true, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 486.46484375, y: 705.46875, mode: "attract" }, { name: "Vert", x: 625.5, y: 134.79296875, mode: "attract" }, { name: "Bleu", x: 233.3383689001411, y: 146.94003927687615, mode: "attract" }]
  },
  {
    name: "mixte all repulse",
    params: { fieldDecay: 0.8277561388653684, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 2.3813862928348914, agentFollowStrength: 0.1258255715495343, agentRandomness: 0.47713801862828115, agentCount: 790, forceRouge: 0.2, forceVert: 0.9, forceBleu: 0.5, globalForce: 3.447078746824725, movementMode: "mixte", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "attract", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: true, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 781.06640625, y: 679.66015625, mode: "attract" }, { name: "Vert", x: 739.16015625, y: 105.1484375, mode: "attract" }, { name: "Bleu", x: 47.94192667547276, y: 22, mode: "repulse" }]
  },
  {
    name: "forceGloba_disspation_vert++",
    params: { fieldDecay: 0.9934060228452752, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 2.929672897196262, agentFollowStrength: 0.1258255715495343, agentRandomness: 1.3737452405676707, agentCount: 790, forceRouge: 0.2, forceVert: 4.1000000000000005, forceBleu: 0.5, globalForce: 7.7872966424368295, movementMode: "mixte", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "repulse", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: false, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 55.1015625, y: 454.19140625, mode: "repulse" }, { name: "Vert", x: 653.5703125, y: 691.79296875, mode: "attract" }, { name: "Bleu", x: 39.27935333508241, y: 55.189954231064846, mode: "repulse" }]
  },
  {
    name: "forceGlobaDissip--ForceVert+",
    params: { fieldDecay: 0.847196261682243, champGain: 2.9051651143099066, showVectors: true, agentSpeed: 2.929672897196262, agentFollowStrength: 0.1258255715495343, agentRandomness: 1.3737452405676707, agentCount: 790, forceRouge: 0.2, forceVert: 4.1000000000000005, forceBleu: 0.5, globalForce: 0.5875735548632744, movementMode: "mixte", champPersistant: true, densityThreshold: 2.4895004233700253, densityTimeThreshold: 6.224132091447926, modeRouge: "repulse", modeVert: "attract", modeBleu: "repulse", attractorRadius: 22, blueAutoMove: true, blueNoiseAmp: 0.8500000000000001, blueNoiseSpeed: 0.024, preloadClosed: true, debugHeatmap: false, agentDrawEvery: 1 },
    attractors: [{ name: "Rouge", x: 55.1015625, y: 454.19140625, mode: "repulse" }, { name: "Vert", x: 298.82421875, y: 736.375, mode: "attract" }, { name: "Bleu", x: 25.67666894778297, y: 22, mode: "repulse" }]
  }
];
const IPHONE_AGENT_COUNT = 48;
const IPHONE_PRESET = JSON.parse(JSON.stringify(DEFAULT_PRESETS[2]));
IPHONE_PRESET.name = "IPhone";
Object.assign(IPHONE_PRESET.params, {
  agentCount: IPHONE_AGENT_COUNT,
  showImageFond: true,
  imageFondAlpha: 55,
  debugHeatmap: false,
  agentDrawEvery: 2,
  preloadClosed: true
});
DEFAULT_PRESETS.push(IPHONE_PRESET);
let presets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));

// -------------------- PARAMS & GUI --------------------
let params = {
  fieldDecay: 0.8277561388653684,
  champGain: 2.9051651143099066,
  showVectors: true,
  agentSpeed: 5.551287044877222,
  agentFollowStrength: 0.1258255715495343,
  agentRandomness: 0.47713801862828115,
  agentCount: 790,
  forceRouge: 0.2,
  forceVert: 0.9,
  forceBleu: 0.5,
  globalForce: 3.447078746824725,
  movementMode: "attracteurs",
  champPersistant: true,
  densityThreshold: 2.4895004233700253,
  densityTimeThreshold: 19.60860159224645,
  modeRouge: "attract",
  modeVert: "attract",
  modeBleu: "repulse",
  attractorRadius: 22,
  blueAutoMove: true,
  blueNoiseAmp: 0.8500000000000001,
  blueNoiseSpeed: 0.024
  ,
  // Options ajoutées
  showImageFond: true,    // affiche l'image en transparence des le demarrage
  imageFondAlpha: 55,     // opacite du fond image (0-180)
  preloadClosed: true,     // si true, précharge l'image oeil fermé en preload()
  debugHeatmap: false,     // active l'affichage d'une heatmap debug (density+field)
  agentDrawEvery: 1        // dessine les agents toutes les N frames (1 = chaque frame)
};

// Mets a true une seule fois si tu veux forcer l'effacement des anciennes
// sauvegardes agentField* au demarrage, puis remets false.
const RESET_SAVED_STATE_ON_START = false;
const APPLY_STARTUP_PRESET_ON_LOAD = true;
const STARTUP_PRESET_NAME = "IPhone";

console.log("⚙️ script chargé");

// ==========================================================
// PRELOAD
// ==========================================================
function preload() {
  console.log("🟣 preload() appelé");
  img = loadImage(
    "visage_femme.png",
    () => {
      console.log("🟢 image oeil ouvert chargée dans preload()");
      imgReady = true;
    },
    err => console.log("🔴 erreur de chargement oeil ouvert dans preload()", err)
  );

  // Précharge optionnelle de l'image fermée selon params.preloadClosed
  if (params && params.preloadClosed) {
    imgClosed = loadImage(
      "visage_homme.png",
      () => {
        console.log("🟢 image oeil fermé préchargée dans preload()");
        imgClosedReady = true;
      },
      err => console.log("⚠️ erreur de préchargement oeil fermé dans preload()", err)
    );
  }
}

// Agent: particule mobile. update() combine 3 composantes :
//  - la direction du champ local (déduite de la grille `field`)
//  - la somme des forces des attracteurs proches
//  - un terme aléatoire pour du bruit
// Le résultat est appliqué à la vitesse, puis à la position.

// Attractor: représente une force dans l'espace. Elle peut être
// attractive ou répulsive (mode), a une position et une force
// dynamique retournée par getStrength().

// ==========================================================
// SETUP
// ==========================================================
function setup() {
  console.log("🟡 setup() appelé");
  createCanvas(800, 800);
  noStroke();
  imageMode(CORNER);
  cellSize = width / gridSize;

  // couche de rendu pour agents (buffer) — permet de réduire le coût
  // de dessin en ne redessinant pas les agents à chaque frame.
  agentLayer = createGraphics(width, height);
  agentLayer.clear();
  agentLayer.noStroke();
  agentLayer.fill(255);

  // grille
  for (let x = 0; x < gridSize; x++) {
    field[x] = [];
    fieldColor[x] = [];
    densityMap[x] = [];
    densityDuration[x] = [];
    for (let y = 0; y < gridSize; y++) {
      field[x][y] = 0;
      fieldColor[x][y] = { state: "base", timer: 0 };
      densityMap[x][y] = 0;
      densityDuration[x][y] = 0;
    }
  }

  // attracteurs init
  attractors = [];
  attractors.push(
    new Attractor(
      "Rouge",
      createVector(width / 2 - 150, height / 2),
      color(255, 0, 0, 200),
      params.modeRouge,
      () => params.forceRouge
    )
  );
  attractors.push(
    new Attractor(
      "Vert",
      createVector(width / 2 + 150, height / 2),
      color(0, 255, 0, 80),
      params.modeVert,
      () => params.forceVert
    )
  );
  attractors.push(
    new Attractor(
      "Bleu",
      createVector(width / 2, height / 2 - 150),
      color(0, 100, 255, 120),
      params.modeBleu,
      () => params.forceBleu
    )
  );
  for (const p of DEFAULT_PRESETS[2].attractors) {
    const a = attractors.find(at => at.name === p.name);
    if (a) {
      a.pos.set(p.x, p.y);
      a.mode = p.mode;
    }
  }

  // charge paramètres + positions
  if (RESET_SAVED_STATE_ON_START) clearSavedState();
  loadParams();
  applyStartupPreset();

  // GUI
  setupGUI();
  setupMobileControls();
  if (typeof window !== "undefined") {
    window.setTimeout(setupMobileControls, 250);
    window.addEventListener("resize", setupMobileControls);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setupMobileControls);
    }
  }

  // agents selon paramètres
  updateAgents();

  // Dessin initial des agents dans le buffer (utile si agentDrawEvery>1)
  if (agentLayer) {
    agentLayer.clear();
    agentLayer.noStroke();
    agentLayer.fill(255);
    for (let a of agents) agentLayer.ellipse(a.pos.x, a.pos.y, 4);
  }

  // forces attracteurs initiales
  for (let attractor of attractors) {
    attractor.strength = attractor.getStrength() * params.globalForce;
  }

  // bouton sauvegarde manuelle
  const saveButton = createButton("Sauvegarder les paramètres");
  saveButton.addClass("desktop-save-button");
  saveButton.position(10, height + 10);
  saveButton.mousePressed(saveParams);
  if (shouldUseMobileControls()) saveButton.hide();

  // reload image pour compat Safari
  loadImage(
    "visage_femme.png",
    loaded => {
      console.log("image oeil ouvert rechargée depuis setup");
      img = loaded;
      imgReady = true;
    },
    err => console.log("⚠️ échec rechargement oeil ouvert depuis setup", err)
  );
}

// ----------------------------------------------------------
// NOTE: setup() termine les initialisations et laisse la boucle
// draw() s'exécuter pour animer la scène. Les paramètres sont
// rechargés depuis localStorage si présents.
// ----------------------------------------------------------

// ==========================================================
// CLASSES
// ==========================================================
class Attractor {
  constructor(name, pos, col, mode = "attract", getStrengthFn = () => 1) {
    this.name = name;
    this.pos = pos;
    this.col = col;
    this.mode = mode;
    this.radius = params.attractorRadius;
    this.getStrength = getStrengthFn;
    this.strength = this.getStrength();
  }
}

class Agent {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(params.agentSpeed);
  }

  update() {
    let fieldVector = createVector(0, 0);
    let attractorForce = createVector(0, 0);

    // composante champ
    if (params.movementMode !== "attracteurs") {
      let gridX = floor(this.pos.x / cellSize);
      let gridY = floor(this.pos.y / cellSize);
      if (gridX >= 0 && gridY >= 0 && gridX < gridSize && gridY < gridSize) {
        let maxVal = field[gridX][gridY];
        let bestDir = createVector(0, 0);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            let nx = gridX + dx;
            let ny = gridY + dy;
            if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize) {
              if (field[nx][ny] > maxVal) {
                maxVal = field[nx][ny];
                bestDir.set(dx, dy);
              }
            }
          }
        }
        bestDir.normalize();
        fieldVector = bestDir.mult(params.agentFollowStrength);
      }
    }

    // composante attracteurs
    for (let attractor of attractors) {
      let dir = p5.Vector.sub(attractor.pos, this.pos);
      let d = dir.mag();
      if (d < attractor.radius * 4) {
        let strength = attractor.getStrength() * params.globalForce;
        let force = dir.normalize().mult(strength / (d * d + 1));
        if (attractor.mode === "repulse") force.mult(-1);
        attractorForce.add(force);
      }
    }

    // mélange
    let move = createVector(0, 0);
    if (params.movementMode === "champ") move = fieldVector;
    else if (params.movementMode === "attracteurs") move = attractorForce;
    else if (params.movementMode === "mixte")
      move = p5.Vector.add(fieldVector, attractorForce);

    this.vel.add(move);
    this.vel.add(p5.Vector.random2D().mult(params.agentRandomness));
    this.vel.limit(params.agentSpeed);
    this.pos.add(this.vel);

    // wrap
    this.pos.x = (this.pos.x + width) % width;
    this.pos.y = (this.pos.y + height) % height;
  }

  display() {
    fill(255);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 4);
  }
}

// ==========================================================
// INTERACTIONS SOURIS / CLAVIER
// ==========================================================
function eventComesFromUi(event) {
  const target = event && event.target;
  return Boolean(
    target &&
    target.closest &&
    target.closest(".dg, .iphone-controls, button, input, select, textarea")
  );
}

function getCanvasPointer(event) {
  const canvas = document.querySelector("canvas");
  const source =
    event && event.touches && event.touches.length
      ? event.touches[0]
      : event && event.changedTouches && event.changedTouches.length
        ? event.changedTouches[0]
        : event;

  if (!canvas || !source || !Number.isFinite(source.clientX)) {
    return createVector(mouseX, mouseY);
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return createVector(mouseX, mouseY);

  return createVector(
    constrain(((source.clientX - rect.left) / rect.width) * width, 0, width),
    constrain(((source.clientY - rect.top) / rect.height) * height, 0, height)
  );
}

function pickAttractorAt(point, relaxedHitArea = false) {
  let bestAttractor = null;
  let bestDistance = Infinity;

  for (let attractor of attractors) {
    const d = dist(point.x, point.y, attractor.pos.x, attractor.pos.y);
    const hitRadius = relaxedHitArea
      ? Math.max(58, attractor.radius * 1.8)
      : attractor.radius / 2.5;
    if (d < hitRadius && d < bestDistance) {
      bestAttractor = attractor;
      bestDistance = d;
    }
  }

  return bestAttractor;
}

function beginAttractorDrag(point, relaxedHitArea = false) {
  selectedAttractor = pickAttractorAt(point, relaxedHitArea);
  if (!selectedAttractor) return false;
  moveSelectedAttractor(point);
  return true;
}

function moveSelectedAttractor(point) {
  if (!selectedAttractor) return false;
  selectedAttractor.pos.set(
    constrain(point.x, selectedAttractor.radius, width - selectedAttractor.radius),
    constrain(point.y, selectedAttractor.radius, height - selectedAttractor.radius)
  );
  return true;
}

function mousePressed(event) {
  if (eventComesFromUi(event) || Date.now() - lastTouchInteractionAt < 500) {
    return true;
  }
  return beginAttractorDrag(getCanvasPointer(event), false) ? false : true;
}

function mouseDragged(event) {
  if (eventComesFromUi(event) || Date.now() - lastTouchInteractionAt < 500) {
    return true;
  }
  return moveSelectedAttractor(getCanvasPointer(event)) ? false : true;
}

function mouseReleased() {
  selectedAttractor = null;
}

function touchStarted(event) {
  lastTouchInteractionAt = Date.now();
  if (eventComesFromUi(event)) return true;
  return beginAttractorDrag(getCanvasPointer(event), true) ? false : true;
}

function touchMoved(event) {
  lastTouchInteractionAt = Date.now();
  if (eventComesFromUi(event)) return true;
  return moveSelectedAttractor(getCanvasPointer(event)) ? false : true;
}

function touchEnded(event) {
  if (eventComesFromUi(event)) return true;
  selectedAttractor = null;
  return false;
}

function keyPressed() {
  if (key === "R") toggleMode(attractors[0]);
  if (key === "V") toggleMode(attractors[1]);
  if (key === "B") toggleMode(attractors[2]);
  if (key === "H") {
    params.debugHeatmap = !params.debugHeatmap;
    console.log("🟣 debugHeatmap ->", params.debugHeatmap);
  }
}

function updateAttractorModeParam(attractor) {
  if (!attractor) return;
  if (attractor.name === "Rouge") params.modeRouge = attractor.mode;
  if (attractor.name === "Vert") params.modeVert = attractor.mode;
  if (attractor.name === "Bleu") params.modeBleu = attractor.mode;
  if (window.gui) window.gui.updateDisplay();
}

function toggleMode(a) {
  if (!a) return;
  a.mode = a.mode === "attract" ? "repulse" : "attract";
  updateAttractorModeParam(a);
}

function shouldUseMobileControls() {
  if (typeof window === "undefined") return false;
  const coarsePointer =
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const visualWidth = window.visualViewport
    ? window.visualViewport.width
    : window.innerWidth;
  return coarsePointer || window.innerWidth <= 820 || visualWidth <= 820;
}

function setGuiVisible(visible) {
  guiVisible = visible;
  const guiRoot = document.querySelector(".dg.ac");
  if (guiRoot) guiRoot.style.display = guiVisible ? "block" : "none";
  if (document.body) document.body.classList.toggle("gui-open", guiVisible);
}

function addMobileControlButton(label, title, onClick) {
  const button = createButton(label);
  button.parent(mobileControls);
  button.addClass("iphone-control-button");
  button.elt.type = "button";
  button.elt.title = title;
  button.elt.setAttribute("aria-label", title);
  button.elt.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onClick(button);
  });
  return button;
}

function updateMobilePresetButton() {
  if (!mobilePresetButton) return;
  const presetNumber = activePresetIndex >= 0 ? activePresetIndex + 1 : "";
  const presetName =
    activePresetIndex >= 0 && presets[activePresetIndex]
      ? presets[activePresetIndex].name
      : "Preset";
  mobilePresetButton.html(presetNumber ? `P${presetNumber}` : "Preset");
  mobilePresetButton.elt.title = presetName;
  mobilePresetButton.elt.setAttribute("aria-label", `Charger le preset suivant. Actuel: ${presetName}`);
}

function updateMobilePauseButton() {
  if (!mobilePauseButton) return;
  mobilePauseButton.html(isPaused ? "Play" : "Pause");
  mobilePauseButton.elt.classList.toggle("is-active", isPaused);
}

function resetSketchCycle() {
  stage = "open";
  transitionActive = false;
  closedRequested = false;
  agentReduceActive = false;
  agentReduceStartFrame = 0;
  agentReduceStartCount = 0;
  holdStartFrame = 0;
  openAlpha = 255;
  closedAlpha = 0;

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      field[x][y] = 0;
      fieldColor[x][y] = { state: "base", timer: 0 };
      densityMap[x][y] = 0;
      densityDuration[x][y] = 0;
    }
  }

  agents = [];
  updateAgents();
  if (agentLayer) agentLayer.clear();
  if (window.gui) window.gui.updateDisplay();
  if (isPaused) redraw();
}

function reloadStartupPreset() {
  const startupPresetIndex = findPresetIndexByName(STARTUP_PRESET_NAME);
  if (startupPresetIndex === -1) return;
  if (applyPreset(startupPresetIndex, { notify: false })) {
    resetSketchCycle();
    updateMobilePresetButton();
  }
}

function loadNextPresetFromMobile() {
  if (!presets.length) return;
  const nextIndex =
    activePresetIndex >= 0 ? (activePresetIndex + 1) % presets.length : 0;
  if (applyPreset(nextIndex, { notify: false })) {
    resetSketchCycle();
    updateMobilePresetButton();
  }
}

function togglePauseFromMobile() {
  isPaused = !isPaused;
  if (isPaused) noLoop();
  else loop();
  updateMobilePauseButton();
}

function toggleBackgroundFromMobile() {
  params.showImageFond = !params.showImageFond;
  if (window.gui) window.gui.updateDisplay();
  if (isPaused) redraw();
}

function setupMobileControls() {
  const saveButton = document.querySelector(".desktop-save-button");

  if (!shouldUseMobileControls()) {
    if (mobileControls) {
      mobileControls.remove();
      mobileControls = null;
    }
    if (saveButton) saveButton.style.display = "";
    if (document.body) document.body.classList.remove("mobile-ui-active");
    setGuiVisible(true);
    return;
  }

  const firstMobileSetup = !mobileControls;
  document.body.classList.add("mobile-ui-active");
  if (firstMobileSetup) setGuiVisible(false);
  else setGuiVisible(guiVisible);
  if (saveButton) saveButton.style.display = "none";

  if (mobileControls) mobileControls.remove();
  mobileControls = createDiv("");
  mobileControls.addClass("iphone-controls");

  addMobileControlButton("GUI", "Afficher ou masquer dat.GUI", button => {
    setGuiVisible(!guiVisible);
    button.elt.classList.toggle("is-active", guiVisible);
  });
  addMobileControlButton("IPhone", "Recharger le preset IPhone", reloadStartupPreset);
  mobilePresetButton = addMobileControlButton(
    "Preset",
    "Charger le preset suivant",
    loadNextPresetFromMobile
  );
  addMobileControlButton("Fond", "Afficher ou masquer le fond image", toggleBackgroundFromMobile);
  addMobileControlButton("Reset", "Relancer le cycle", resetSketchCycle);
  mobilePauseButton = addMobileControlButton("Pause", "Pause ou lecture", togglePauseFromMobile);

  updateMobilePresetButton();
  updateMobilePauseButton();
}

// ==========================================================
// GUI + SAUVEGARDE
// ==========================================================
function setupGUI() {
  clearDatGuiStorage();
  let gui = new dat.GUI();
  window.gui = gui; // Référence globale pour la mise à jour
  gui.add(params, "movementMode", ["champ", "attracteurs", "mixte"])
    .name("Mode Déplacement")
    .onChange(updateMovementMode);
  gui.add(params, "agentCount", 48, 10000, 1)
    .name("Nombre d'agents")
    .onChange(updateAgents);
  gui.add(params, "forceRouge", 0, 5, 0.1).name("Force Rouge");
  gui.add(params, "forceVert", 0, 5, 0.1).name("Force Vert");
  gui.add(params, "forceBleu", 0, 5, 0.1).name("Force Bleu");
  gui.add(params, "modeRouge", ["attract", "repulse"])
    .name("Mode Rouge")
    .onChange(v => (attractors[0].mode = v));
  gui.add(params, "modeVert", ["attract", "repulse"])
    .name("Mode Vert")
    .onChange(v => (attractors[1].mode = v));
  gui.add(params, "modeBleu", ["attract", "repulse"])
    .name("Mode Bleu")
    .onChange(v => (attractors[2].mode = v));
  gui.add(params, "champPersistant")
    .name("Champ Persistant")
    .onChange(updateChampPersistant);
  gui.add(params, "globalForce", 0, 10).name("Force Globale");
  gui.add(params, "agentSpeed", 0.1, 10).name("Vitesse Agent");
  gui.add(params, "agentRandomness", 0, 5).name("Aléa Agent");
  gui.add(params, "agentFollowStrength", 0, 2).name("Suivi Champ");
  gui.add(params, "champGain", 0, 10).name("Gain Champ");
  gui.add(params, "fieldDecay", 0.8, 1.0).name("Dissipation");
  gui.add(params, "densityThreshold", 1, 50).name("Seuil densité");
  gui.add(params, "densityTimeThreshold", 1, 600).name("Durée amas");
  gui.add(params, "attractorRadius", 20, 200, 1)
    .name("Rayon Attracteurs")
    .onChange(v => {
      for (let a of attractors) a.radius = v;
    });
  gui.add(params, "blueAutoMove").name("Bleu auto-move");
  gui.add(params, "blueNoiseAmp", 0, 5, 0.05).name("Bleu amplitude");
  gui.add(params, "blueNoiseSpeed", 0.001, 0.05, 0.001).name("Bleu vitesse");
  gui.add({ save: saveParams }, "save").name("📋 Sauvegarder");

  // Options ajoutées : préchargement image fermée, heatmap debug, fréquence dessin agents
  gui.add(params, "showImageFond").name("Voir image fond");
  gui.add(params, "imageFondAlpha", 0, 180, 1).name("Opacité fond");
  gui.add(params, "preloadClosed").name("Précharger œil fermé").onChange(v => {
    if (v && !imgClosedReady) {
      loadImage(
        "visage_homme.png",
        loaded => {
          imgClosed = loaded;
          imgClosedReady = true;
          console.log("🟢 image oeil fermé chargée (via GUI)");
        },
        err => console.log("🔴 erreur chargement image fermée via GUI", err)
      );
    } else if (!v) {
      // Si on désactive le préchargement on peut libérer la référence
      imgClosedReady = false;
      imgClosed = null;
      console.log("ℹ️ préchargement oeil fermé désactivé (GUI)");
    }
  });
  gui.add(params, "debugHeatmap").name("Afficher heatmap (debug)");
  gui.add(params, "agentDrawEvery", 1, 10, 1).name("Agent draw every N frames");

  // --- SECTION PRESETS ---
  const presetsFolder = gui.addFolder("💾 Presets");
  for (let i = 0; i < presets.length; i++) {
    const presetFolder = presetsFolder.addFolder(`Slot ${i + 1}: ${presets[i].name}`);
    presetFolder.add({
      save: () => savePreset(i)
    }, "save").name("💾 Sauvegarder");
    presetFolder.add({
      load: () => loadPreset(i)
    }, "load").name("📂 Charger");
    presetFolder.add({
      rename: () => {
        const newName = prompt("Entrez un nouveau nom pour ce preset:", presets[i].name);
        if (newName !== null && newName.trim() !== "") {
          renamePreset(i, newName.trim());
        }
      }
    }, "rename").name("✏️ Renommer");
  }
  presetsFolder.open();
}

function saveParams() {
  localStorage.setItem("agentFieldParams", JSON.stringify(params));
  const attractorPositions = attractors.map(a => ({
    name: a.name,
    x: a.pos.x,
    y: a.pos.y,
    mode: a.mode
  }));
  localStorage.setItem(
    "attractorPositions",
    JSON.stringify(attractorPositions)
  );
  console.log("💾 paramètres sauvegardés");
}

function clearSavedState() {
  try {
    localStorage.removeItem("agentFieldParams");
    localStorage.removeItem("attractorPositions");
    localStorage.removeItem("agentFieldPresets");
    clearDatGuiStorage();
    console.log("🧹 sauvegardes locales effacées");
  } catch (err) {
    console.warn("Impossible d'effacer les sauvegardes locales", err);
  }
}

function clearDatGuiStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.endsWith(".gui") || key.endsWith(".isLocal"))) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn("Impossible de nettoyer le stockage dat.GUI", err);
  }
}

function clampNumber(value, minValue, maxValue, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(maxValue, Math.max(minValue, n));
}

function normalizeParamsObject(target) {
  target.fieldDecay = clampNumber(target.fieldDecay, 0.8, 1, 0.95);
  target.champGain = clampNumber(target.champGain, 0, 10, 1.5);
  target.agentSpeed = clampNumber(target.agentSpeed, 0.1, 10, 4);
  target.agentFollowStrength = clampNumber(target.agentFollowStrength, 0, 2, 0.6);
  target.agentRandomness = clampNumber(target.agentRandomness, 0, 5, 1.2);
  target.agentCount = Math.round(clampNumber(target.agentCount, 48, 10000, 48));
  target.forceRouge = clampNumber(target.forceRouge, 0, 5, 1.5);
  target.forceVert = clampNumber(target.forceVert, 0, 5, 1.5);
  target.forceBleu = clampNumber(target.forceBleu, 0, 5, 1.5);
  target.globalForce = clampNumber(target.globalForce, 0, 10, 1);
  target.densityThreshold = clampNumber(target.densityThreshold, 1, 50, 10);
  target.densityTimeThreshold = clampNumber(target.densityTimeThreshold, 1, 600, 300);
  target.attractorRadius = clampNumber(target.attractorRadius, 20, 200, 50);
  target.blueNoiseAmp = clampNumber(target.blueNoiseAmp, 0, 5, 1.2);
  target.blueNoiseSpeed = clampNumber(target.blueNoiseSpeed, 0.001, 0.05, 0.008);
  target.imageFondAlpha = clampNumber(target.imageFondAlpha, 0, 180, 55);
  target.agentDrawEvery = Math.round(clampNumber(target.agentDrawEvery, 1, 10, 1));

  if (!["champ", "attracteurs", "mixte"].includes(target.movementMode)) {
    target.movementMode = "champ";
  }
  for (const key of ["modeRouge", "modeVert", "modeBleu"]) {
    if (!["attract", "repulse"].includes(target[key])) target[key] = "attract";
  }
  target.champPersistant = Boolean(target.champPersistant);
  target.blueAutoMove = Boolean(target.blueAutoMove);
  target.showVectors = Boolean(target.showVectors);
  target.showImageFond = target.showImageFond !== false;
  target.preloadClosed = Boolean(target.preloadClosed);
  target.debugHeatmap = Boolean(target.debugHeatmap);
}

function makeDefaultPresets() {
  return JSON.parse(JSON.stringify(DEFAULT_PRESETS));
}

function normalizePresetParams(source) {
  if (!source || typeof source !== "object") return null;
  const restored = JSON.parse(JSON.stringify(params));
  for (const key in source) {
    if (restored.hasOwnProperty(key)) restored[key] = source[key];
  }
  normalizeParamsObject(restored);
  return restored;
}

function normalizePresetList(source) {
  const normalized = makeDefaultPresets();
  if (!Array.isArray(source)) return normalized;

  for (let i = 0; i < normalized.length; i++) {
    const slot = source[i];
    if (!slot || typeof slot !== "object") continue;
    normalized[i].name = String(slot.name || `Preset ${i + 1}`);
    normalized[i].params = normalizePresetParams(slot.params);
    normalized[i].attractors = Array.isArray(slot.attractors)
      ? slot.attractors
          .map(p => ({
            name: String(p.name || ""),
            x: clampNumber(p.x, 0, width || 800, width / 2 || 400),
            y: clampNumber(p.y, 0, height || 800, height / 2 || 400),
            mode: ["attract", "repulse"].includes(p.mode) ? p.mode : "attract"
          }))
          .filter(p => ["Rouge", "Vert", "Bleu"].includes(p.name))
      : null;
  }
  enforceIphonePresetAgentCount(normalized);
  return normalized;
}

function enforceIphonePresetAgentCount(list) {
  if (!Array.isArray(list)) return;
  for (const preset of list) {
    if (preset && preset.name === STARTUP_PRESET_NAME && preset.params) {
      preset.params.agentCount = IPHONE_AGENT_COUNT;
    }
  }
}

function countFilledPresets(list) {
  return list.filter(slot => slot && slot.params).length;
}

function shouldUseStoredPresets(list) {
  if (!Array.isArray(list)) return false;
  if (countFilledPresets(list) >= 2) return true;
  return list.some((slot, i) => {
    const defaultName = `Preset ${i + 1}`;
    return slot && slot.params && slot.name && slot.name !== defaultName;
  });
}

function loadParams() {
  try {
    const saved = localStorage.getItem("agentFieldParams");
    if (saved) {
      const parsed = JSON.parse(saved);
      for (let key in parsed)
        if (params.hasOwnProperty(key)) params[key] = parsed[key];
      normalizeParamsObject(params);
      console.log("✅ paramètres rechargés (agentCount:", params.agentCount + ")");
      // Applique le nombre d'agents sauvegardé
      updateAgents();
    }
  } catch (err) {
    console.warn("⚠️ paramètres sauvegardés ignorés", err);
    localStorage.removeItem("agentFieldParams");
  }

  try {
    const posData = localStorage.getItem("attractorPositions");
    if (posData) {
      const loadedPositions = JSON.parse(posData);
      if (!Array.isArray(loadedPositions)) throw new Error("positions invalides");
      for (let p of loadedPositions) {
        let a = attractors.find(at => at.name === p.name);
        if (a) {
          a.pos.x = clampNumber(p.x, a.radius, width - a.radius, a.pos.x);
          a.pos.y = clampNumber(p.y, a.radius, height - a.radius, a.pos.y);
          a.mode = ["attract", "repulse"].includes(p.mode) ? p.mode : "attract";
        }
      }
      console.log("✅ positions attracteurs rechargées");
    }
  } catch (err) {
    console.warn("⚠️ positions sauvegardées ignorées", err);
    localStorage.removeItem("attractorPositions");
  }

  try {
    // Charge les presets
    const savedPresets = localStorage.getItem("agentFieldPresets");
    if (savedPresets) {
      const parsed = JSON.parse(savedPresets);
      const loadedPresets = normalizePresetList(parsed);
      if (shouldUseStoredPresets(loadedPresets)) {
        presets = loadedPresets;
        console.log("✅ presets rechargés");
      } else {
        presets = makeDefaultPresets();
        console.log("✅ presets Chrome intégrés utilisés");
      }
    } else {
      presets = normalizePresetList(presets);
    }
  } catch (err) {
    console.warn("⚠️ presets sauvegardés ignorés", err);
    localStorage.removeItem("agentFieldPresets");
    presets = makeDefaultPresets();
  }
}

function findPresetIndexByName(name) {
  return presets.findIndex(slot => slot && slot.name === name);
}

function applyStartupPreset() {
  if (!APPLY_STARTUP_PRESET_ON_LOAD) return;

  const startupPresetIndex = findPresetIndexByName(STARTUP_PRESET_NAME);
  if (startupPresetIndex === -1) {
    console.warn(`⚠️ preset de démarrage introuvable: ${STARTUP_PRESET_NAME}`);
    return;
  }

  if (applyPreset(startupPresetIndex, { notify: false, updateGui: false })) {
    console.log(`🚀 preset de démarrage appliqué: ${STARTUP_PRESET_NAME}`);
  }
}

// ==========================================================
// AUTRES FONCTIONS
// ==========================================================
function updateMovementMode() {
  console.log("Mode de déplacement mis à jour :", params.movementMode);
}

function updateChampPersistant(value) {
  if (!value) {
    for (let x = 0; x < gridSize; x++)
      for (let y = 0; y < gridSize; y++)
        field[x][y] = 0;
    console.log("Champ vidé car mode persistant désactivé.");
  }
}

function updateAgents() {
  normalizeParamsObject(params);
  while (agents.length < params.agentCount) agents.push(new Agent());
  while (agents.length > params.agentCount) agents.pop();
}

// ==========================================================
// GESTION DES PRESETS
// ==========================================================
function savePreset(index) {
  if (index < 0 || index >= presets.length) return;

  // Sauvegarde une copie profonde des paramètres
  presets[index].params = JSON.parse(JSON.stringify(params));

  // Sauvegarde les positions et modes des attracteurs
  presets[index].attractors = attractors.map(a => ({
    name: a.name,
    x: a.pos.x,
    y: a.pos.y,
    mode: a.mode
  }));

  // Persiste dans localStorage
  localStorage.setItem("agentFieldPresets", JSON.stringify(presets));

  console.log(`💾 Preset ${index + 1} (${presets[index].name}) sauvegardé`);
  alert(`Preset "${presets[index].name}" sauvegardé avec succès!`);
}

function applyPreset(index, options = {}) {
  const { notify = true, updateGui = true } = options;
  if (index < 0 || index >= presets.length) return;
  if (!presets[index] || !presets[index].params) {
    if (notify) alert(`Le preset "${presets[index].name}" est vide!`);
    return false;
  }

  // Restaure les paramètres
  const restoredParams = normalizePresetParams(presets[index].params);
  for (let key in restoredParams) {
    if (params.hasOwnProperty(key)) {
      params[key] = restoredParams[key];
    }
  }

  // Restaure les positions des attracteurs
  if (presets[index].attractors) {
    for (let p of presets[index].attractors) {
      let a = attractors.find(at => at.name === p.name);
      if (a) {
        a.pos.x = clampNumber(p.x, a.radius, width - a.radius, a.pos.x);
        a.pos.y = clampNumber(p.y, a.radius, height - a.radius, a.pos.y);
        a.mode = ["attract", "repulse"].includes(p.mode) ? p.mode : "attract";
      }
    }
  }

  // Met à jour le nombre d'agents
  updateAgents();

  // Met à jour le rayon des attracteurs
  for (let a of attractors) {
    a.radius = params.attractorRadius;
  }

  console.log(`📂 Preset ${index + 1} (${presets[index].name}) chargé`);
  activePresetIndex = index;
  updateMobilePresetButton();
  if (notify) alert(`Preset "${presets[index].name}" chargé avec succès!`);

  // Force la mise à jour de la GUI
  if (updateGui && window.gui) {
    window.gui.updateDisplay();
  }

  return true;
}

function loadPreset(index) {
  applyPreset(index);
}

function renamePreset(index, newName) {
  if (index < 0 || index >= presets.length) return;

  presets[index].name = newName;

  // Persiste dans localStorage
  localStorage.setItem("agentFieldPresets", JSON.stringify(presets));

  console.log(`✏️ Preset ${index + 1} renommé en "${newName}"`);

  // Recrée la GUI pour afficher le nouveau nom
  if (window.gui) {
    window.gui.destroy();
    setupGUI();
  }

  alert(`Preset renommé en "${newName}"!`);
}

// ==========================================================
// DRAW + TRANSITION + RELANCE
// ==========================================================
// draw(): boucle principale — met à jour le champ, calcule la
// densité, gère les phases (open/transition/hold/relaunch),
// met à jour et dessine les agents et attracteurs.
function draw() {
  if (!imgReady) {
    fill(255);
    textAlign(CENTER, CENTER);
    text("Image pas encore chargée...", width / 2, height / 2);
    return;
  }

  background(0);
  if (params.showImageFond && img) {
    push();
    tint(255, params.imageFondAlpha);
    image(img, 0, 0, width, height);
    pop();
  }

  // --- Mouvement Perlin attracteur bleu ---
  if (params.blueAutoMove && attractors[2]) {
    const a = attractors[2];
    blueNX += params.blueNoiseSpeed;
    blueNY += params.blueNoiseSpeed;
    const vx = (noise(blueNX) - 0.5) * 2 * params.blueNoiseAmp;
    const vy = (noise(blueNY) - 0.5) * 2 * params.blueNoiseAmp;
    a.pos.x += vx;
    a.pos.y += vy;
    a.pos.x = constrain(a.pos.x, a.radius, width - a.radius);
    a.pos.y = constrain(a.pos.y, a.radius, height - a.radius);
  }

  // --- Champ de potentiel ---
  for (let attractor of attractors) {
    attractor.strength = attractor.getStrength() * params.globalForce;
  }
  updatePotentialField();

  // --- reset densité ---
  for (let x = 0; x < gridSize; x++)
    for (let y = 0; y < gridSize; y++)
      densityMap[x][y] = 0;

  // --- calc densité ---
  for (let agent of agents) {
    let gx = floor(agent.pos.x / cellSize);
    let gy = floor(agent.pos.y / cellSize);
    if (gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize) {
      densityMap[gx][gy]++;
    }
  }

  // --- Gestion de la transition, du flip et du hold ---
  if (transitionActive && imgClosedReady) {
    let elapsed = frameCount - transitionStartFrame;
    let t = constrain(elapsed / transitionDurationFrames, 0, 1);
    openAlpha = 255 * (1 - t);
    closedAlpha = maxClosedAlpha * t; // fond pendant transition

    // 🔁 Flip toutes les 30 frames entre fond "fermé" et "ouvert"
    const flipClosed = Math.floor(elapsed / 30) % 2 === 0;
    if (flipClosed) {
      push(); tint(255, closedAlpha); image(imgClosed, 0, 0, width, height); pop();
    } else {
      push(); tint(255, openAlpha); image(img, 0, 0, width, height); pop();
    }

    if (t >= 1) {
      // Transition terminée
      transitionActive = false;
      openAlpha = 0;
      closedAlpha = maxClosedAlpha;

      // Démarre la réduction progressive d'agents → 300 sur 160 frames
      agentReduceActive = true;
      agentReduceStartFrame = frameCount;
      agentReduceStartCount = agents.length;

      stage = "hold";
      holdStartFrame = frameCount;
      console.log("✅ transition OK → hold + réduction progressive d'agents");
    }
  }

  // Réduction progressive d'agents (indépendante de la phase courante)
  if (agentReduceActive) {
    let rt = (frameCount - agentReduceStartFrame) / agentReduceDuration;
    if (rt >= 1) {
      params.agentCount = agentTargetCount;
      updateAgents();
      agentReduceActive = false;
    } else {
      const current = Math.round(lerp(agentReduceStartCount, agentTargetCount, rt));
      if (current !== params.agentCount) {
        params.agentCount = current;
        updateAgents();
      }
    }
  }

  // --- Phase 3 : œil fermé plein cadre (hold) ---
  if (stage === "hold" && imgClosedReady) {
    // updatePotentialField(): pour chaque attracteur, ajoute son
    // influence aux cellules de la grille `field`. L'influence décroît
    // en ~1/d^2 et est multipliée par `params.champGain`.
    image(imgClosed, 0, 0, width, height); // plein cadre

    if (frameCount - holdStartFrame >= holdClosedFrames) {
      // Phase 4 : retour à la phase open — on réinitialise pour recommencer le cycle
      for (let x = 0; x < gridSize; x++)
        for (let y = 0; y < gridSize; y++)
          densityDuration[x][y] = 0;

      // Réinitialisation des alphas et du flag pour permettre un nouveau cycle
      openAlpha = 255;
      closedAlpha = 0;
      closedRequested = false;

      stage = "open";
      console.log("🔁 Retour à la phase open : révélation de l'œil ouvert.");
    }
  }

  // --- Phase 2 (affichage de fond si transitionActive est faux parce que t==0 ? déjà géré ci-dessus) ---
  if (stage === "transition" && imgClosedReady && !transitionActive) {
    // sécurité : si jamais on entre dans transition sans active (rare)
    push(); tint(255, closedAlpha); image(imgClosed, 0, 0, width, height); pop();
  }

  // --- 2) GRILLE + SURFACES BLEUES + PATCHS ---
  // Si mode debug activé, afficher une heatmap combinée (density red / field blue)
  if (params.debugHeatmap) {
    push();
    rectMode(CORNER);
    noStroke();
    // calculs de normalisation
    let maxD = 1;
    let minF = Infinity;
    let maxF = -Infinity;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        maxD = max(maxD, densityMap[x][y]);
        minF = min(minF, field[x][y]);
        maxF = max(maxF, field[x][y]);
      }
    }
    // dessine la heatmap sur la grille
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        let dn = maxD > 0 ? densityMap[x][y] / maxD : 0;
        let fn = (maxF - minF) !== 0 ? (field[x][y] - minF) / (maxF - minF) : 0.5;
        let r = floor(constrain(dn * 255, 0, 255));
        let b = floor(constrain(fn * 255, 0, 255));
        fill(r, 0, b, 160);
        rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    pop();
  }

  let revealedCount = 0; // pour déclencher la transition en Phase 1
  noStroke();
  rectMode(CENTER);

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      let val = field[x][y];
      let cData = fieldColor[x][y];

      if (densityMap[x][y] > params.densityThreshold) {
        densityDuration[x][y]++;
      } else {
        densityDuration[x][y] = max(0, densityDuration[x][y] - 1);
      }

      let px = x * cellSize + cellSize / 2;
      let py = y * cellSize + cellSize / 2;
      let size = cellSize * 0.8;

      if (val > 1 && cData.state !== "active") {
        cData.state = "active";
        cData.timer = 10;
      }

      if (cData.state === "active" && cData.timer > 0) {
        fill(180, 220, 255, map(cData.timer, 0, 10, 0, 200));
        cData.timer--;
      } else {
        let blueIntensity = map(val, 0, 10, 0, 255);
        fill(50, 150, 255, constrain(blueIntensity, 0, 255));
      }

      // Carrés bleus (on évite de couvrir la vue plein cadre pendant le hold)
      if (stage !== "hold") rect(px, py, size, size);

      // --- PATCHS ---
      // Phase 1: révélation de l'œil OUVERT
      if (
        stage === "open" &&
        densityDuration[x][y] > params.densityTimeThreshold &&
        img && img.width > 0 && openAlpha > 0
      ) {
        revealedCount++;
        let sx = floor((x * img.width) / gridSize);
        let sy = floor((y * img.height) / gridSize);
        let sw = floor(img.width / gridSize);
        let sh = floor(img.height / gridSize);
        push();
        tint(255, openAlpha);
        image(img, x * cellSize, y * cellSize, cellSize, cellSize, sx, sy, sw, sh);
        pop();
      }

      // Phase 4: relance — révélation de l'œil FERMÉ
      if (
        stage === "relaunch" &&
        imgClosedReady &&
        densityDuration[x][y] > params.densityTimeThreshold
      ) {
        let sx2 = floor((x * imgClosed.width) / gridSize);
        let sy2 = floor((y * imgClosed.height) / gridSize);
        let sw2 = floor(imgClosed.width / gridSize);
        let sh2 = floor(imgClosed.height / gridSize);
        image(
          imgClosed,
          x * cellSize,
          y * cellSize,
          cellSize,
          cellSize,
          sx2, sy2, sw2, sh2
        );
      }

      field[x][y] *= params.fieldDecay;
    }
  }

  // --- 3) AGENTS ---
  // Mise à jour des agents (toujours)
  for (let agent of agents) {
    agent.update();
  }

  // Dessin des agents : soit en direct (agentDrawEvery==1), soit via buffer
  if (params.agentDrawEvery === 1) {
    for (let agent of agents) {
      agent.display();
    }
  } else {
    // on redessine le buffer uniquement toutes les N frames
    if (frameCount % params.agentDrawEvery === 0) {
      if (agentLayer) {
        agentLayer.clear();
        agentLayer.noStroke();
        agentLayer.fill(255);
        for (let a of agents) agentLayer.ellipse(a.pos.x, a.pos.y, 4);
      }
    }
    // on affiche le buffer
    if (agentLayer) image(agentLayer, 0, 0);
  }

  // --- 4) ATTRACTEURS ---
  for (let attractor of attractors) {
    const effectiveStrength = attractor.getStrength() * params.globalForce;
    const sw = map(effectiveStrength, 0, 5, 1, 6, true);
    noFill();
    stroke(attractor.col);
    strokeWeight(sw);
    circle(attractor.pos.x, attractor.pos.y, attractor.radius * 2);
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(
      attractor.mode,
      attractor.pos.x,
      attractor.pos.y - attractor.radius - 10
    );
  }

  // --- 5) Seuil 60% : déclenchement du crossfade (Phase 2) ---
  if (stage === "open") {
    const totalCells = gridSize * gridSize;
    const revealedRatio = revealedCount / totalCells;

    if (!closedRequested && revealedRatio >= 0.6) {
      closedRequested = true;
      console.log("🟠 Seuil 60% atteint → chargement visage_homme.png & début transition");
      loadImage(
        "visage_homme.png",
        loaded => {
          imgClosed = loaded;
          imgClosedReady = true;
          console.log("🟢 image oeil fermé chargée");
          transitionActive = true;
          transitionStartFrame = frameCount;
          stage = "transition";
        },
        err => console.log("🔴 erreur chargement image fermée", err)
      );
    }
  }
}

// ==========================================================
// CHAMP DE POTENTIEL
// ==========================================================
function updatePotentialField() {
  if (!params.champPersistant) {
    for (let x = 0; x < gridSize; x++)
      for (let y = 0; y < gridSize; y++)
        field[x][y] = 0;
  }

  for (let attractor of attractors) {
    let localStrength = attractor.strength * params.globalForce;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        let cx = x * cellSize + cellSize / 2;
        let cy = y * cellSize + cellSize / 2;
        let d = dist(cx, cy, attractor.pos.x, attractor.pos.y);
        if (d < attractor.radius * 4) {
          let influence = localStrength / (d * d + 1);
          if (attractor.mode === "repulse") influence *= -1;
          field[x][y] += influence * params.champGain;
        }
      }
    }
  }
}
