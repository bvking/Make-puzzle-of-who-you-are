// Extension display-photo-backGround_random : puzzle aleatoire avec les visages captures.
(function installDisplayPhotoBackgroundRandomExtension() {
  const PRESET_NAME = "display-photo-backGround_random";
  const PHOTO_STORAGE_KEY = "captureFaceAlignedPhotos";
  const MAX_PHOTOS = 10;
  const MOSAIC_DELAY_MS = 1000;
  const COMPLETE_HOLD_MS = 800;
  const BLINK_INTERVAL_MS = 650;

  const imageCache = new Map();
  const state = {
    active: false,
    startedAt: 0,
    completedAt: 0,
    primaryUrl: "",
    alternateUrl: "",
    grid: 0,
    total: 0,
    locked: [],
    primaryMap: [],
    alternateMap: [],
    primaryLayer: null,
    alternateLayer: null,
    primaryDirty: true,
    alternateDirty: true
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueLastTen(urls) {
    const seen = new Set();
    const unique = [];
    for (const url of urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      unique.push(url);
    }
    return unique.slice(-MAX_PHOTOS);
  }

  function readStoredPhotoUrls() {
    try {
      const raw = localStorage.getItem(PHOTO_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (err) {
      console.warn("Photos ignorees depuis localStorage", err);
      return [];
    }
  }

  function readGalleryPhotoUrls() {
    const gallery = document.getElementById("capture-face-gallery");
    if (!gallery) return [];
    return Array.from(gallery.querySelectorAll("img"))
      .map(image => image && image.src)
      .filter(src => src && src.startsWith("data:image/"));
  }

  function syncPhotoUrls() {
    return uniqueLastTen([
      ...readStoredPhotoUrls(),
      ...readGalleryPhotoUrls()
    ]);
  }

  function ensureP5Image(url) {
    if (!url || typeof loadImage !== "function") return null;

    const cached = imageCache.get(url);
    if (cached && cached.state === "loaded") return cached.image;
    if (cached && cached.state === "loading") return null;

    imageCache.set(url, { state: "loading", image: null });
    loadImage(
      url,
      loaded => {
        imageCache.set(url, { state: "loaded", image: loaded });
        state.primaryDirty = true;
        state.alternateDirty = true;
      },
      err => {
        imageCache.delete(url);
        console.warn("Impossible de charger une photo random", err);
      }
    );
    return null;
  }

  function getLoadedPhotoItems() {
    return syncPhotoUrls()
      .map(url => ({ url, image: ensureP5Image(url) }))
      .filter(item => item.image);
  }

  function shuffle(values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function makeDerangedMap(total) {
    if (total <= 1) return [0];
    const base = Array.from({ length: total }, (_, index) => index);
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = shuffle(base);
      if (candidate.every((source, index) => source !== index)) return candidate;
    }
    return base.map((_, index) => (index + 1) % total);
  }

  function ensureGridState() {
    const currentGrid = typeof gridSize === "number" ? gridSize : 20;
    const total = currentGrid * currentGrid;
    if (state.grid === currentGrid && state.total === total && state.primaryMap.length === total) {
      return;
    }

    state.grid = currentGrid;
    state.total = total;
    state.locked = Array(total).fill(false);
    state.primaryMap = makeDerangedMap(total);
    state.alternateMap = makeDerangedMap(total);
    state.primaryDirty = true;
    state.alternateDirty = true;
  }

  function indexForCell(x, y) {
    return y * state.grid + x;
  }

  function lockCell(index) {
    if (state.locked[index]) return;

    const previousSource = state.primaryMap[index];
    const holder = state.primaryMap.findIndex(
      (source, destination) => source === index && destination !== index && !state.locked[destination]
    );
    state.locked[index] = true;
    state.primaryMap[index] = index;
    if (holder >= 0) state.primaryMap[holder] = previousSource;
    state.primaryDirty = true;
  }

  function lockAllCells() {
    ensureGridState();
    for (let i = 0; i < state.total; i++) {
      state.locked[i] = true;
      state.primaryMap[i] = i;
    }
    state.primaryDirty = true;
  }

  function isPresetActive() {
    return (
      state.active &&
      typeof activePresetIndex !== "undefined" &&
      activePresetIndex >= 0 &&
      Array.isArray(presets) &&
      presets[activePresetIndex] &&
      presets[activePresetIndex].name === PRESET_NAME
    );
  }

  function choosePhotoUrls() {
    const urls = syncPhotoUrls();
    if (!urls.length) {
      state.primaryUrl = "";
      state.alternateUrl = "";
      return;
    }

    state.primaryUrl = urls[Math.floor(Math.random() * urls.length)];
    const alternates = urls.filter(url => url !== state.primaryUrl);
    state.alternateUrl = (alternates.length ? alternates : urls)[
      Math.floor(Math.random() * (alternates.length ? alternates.length : urls.length))
    ];
    ensureP5Image(state.primaryUrl);
    ensureP5Image(state.alternateUrl);
  }

  function getPrimaryImage() {
    let image = ensureP5Image(state.primaryUrl);
    if (image) return image;
    const items = getLoadedPhotoItems();
    if (!items.length) return null;
    if (!state.primaryUrl) state.primaryUrl = items[0].url;
    return items.find(item => item.url === state.primaryUrl)?.image || items[0].image;
  }

  function getAlternateImage() {
    let image = ensureP5Image(state.alternateUrl);
    if (image) return image;
    const items = getLoadedPhotoItems();
    if (!items.length) return getPrimaryImage();
    const alternate = items.find(item => item.url !== state.primaryUrl) || items[0];
    if (!state.alternateUrl) state.alternateUrl = alternate.url;
    return alternate.image;
  }

  function ensureLayer(layerName) {
    const layer = state[layerName];
    if (
      layer &&
      layer.width === width &&
      layer.height === height
    ) {
      return layer;
    }
    state[layerName] = createGraphics(width, height);
    state.primaryDirty = true;
    state.alternateDirty = true;
    return state[layerName];
  }

  function drawTile(target, sourceImage, destinationIndex, sourceIndex) {
    const destinationX = destinationIndex % state.grid;
    const destinationY = Math.floor(destinationIndex / state.grid);
    const sourceX = sourceIndex % state.grid;
    const sourceY = Math.floor(sourceIndex / state.grid);
    const targetWidth = target === window ? width : target.width;
    const targetHeight = target === window ? height : target.height;
    const dw = targetWidth / state.grid;
    const dh = targetHeight / state.grid;
    const dx = destinationX * dw;
    const dy = destinationY * dh;
    const sx0 = Math.floor((sourceX * sourceImage.width) / state.grid);
    const sy0 = Math.floor((sourceY * sourceImage.height) / state.grid);
    const sx1 = Math.floor(((sourceX + 1) * sourceImage.width) / state.grid);
    const sy1 = Math.floor(((sourceY + 1) * sourceImage.height) / state.grid);
    const sw = Math.max(1, sx1 - sx0);
    const sh = Math.max(1, sy1 - sy0);
    if (target === window) {
      image(sourceImage, dx, dy, dw + 0.5, dh + 0.5, sx0, sy0, sw, sh);
    } else {
      target.image(sourceImage, dx, dy, dw + 0.5, dh + 0.5, sx0, sy0, sw, sh);
    }
  }

  function getMosaicLayer(sourceImage, mapping, layerName, dirtyName) {
    ensureGridState();
    const layer = ensureLayer(layerName);
    if (!state[dirtyName]) return layer;

    layer.clear();
    layer.noSmooth();
    for (let index = 0; index < state.total; index++) {
      drawTile(layer, sourceImage, index, mapping[index] ?? index);
    }
    state[dirtyName] = false;
    return layer;
  }

  function getRevealedCellIndices() {
    ensureGridState();
    const revealed = [];
    if (!Array.isArray(densityDuration)) return revealed;

    for (let x = 0; x < state.grid; x++) {
      for (let y = 0; y < state.grid; y++) {
        if (
          densityDuration[x] &&
          densityDuration[x][y] > params.densityTimeThreshold
        ) {
          const index = indexForCell(x, y);
          lockCell(index);
          revealed.push(index);
        }
      }
    }
    return revealed;
  }

  function drawMappedCells(indices, sourceImage, mapping, alpha = 255) {
    if (!sourceImage || !indices.length) return;
    push();
    tint(255, alpha);
    for (const destinationIndex of indices) {
      drawTile(window, sourceImage, destinationIndex, mapping[destinationIndex] ?? destinationIndex);
    }
    pop();
  }

  function drawActiveOverlay() {
    if (!isPresetActive()) return;
    if (Date.now() - state.startedAt < MOSAIC_DELAY_MS) return;

    ensureGridState();

    if (state.completedAt) {
      const allCells = Array.from({ length: state.total }, (_, index) => index);
      if (currentBlinkShowsAlternate()) {
        drawMappedCells(allCells, getAlternateImage() || getPrimaryImage(), state.alternateMap);
      } else {
        drawMappedCells(allCells, getPrimaryImage(), state.primaryMap);
      }
      return;
    }

    const revealed = getRevealedCellIndices();
    const revealedRatio = state.total > 0 ? revealed.length / state.total : 0;
    if (revealedRatio >= 0.6) {
      lockAllCells();
      state.completedAt = Date.now();
      drawMappedCells(
        Array.from({ length: state.total }, (_, index) => index),
        getPrimaryImage(),
        state.primaryMap
      );
      return;
    }

    drawMappedCells(revealed, getPrimaryImage(), state.primaryMap);
  }

  function currentBlinkShowsAlternate() {
    if (!state.completedAt) return false;
    const elapsed = Date.now() - state.completedAt;
    if (elapsed < COMPLETE_HOLD_MS) return false;
    return Math.floor((elapsed - COMPLETE_HOLD_MS) / BLINK_INTERVAL_MS) % 2 === 1;
  }

  function makePreset() {
    const sourcePreset =
      typeof IPHONE_PRESET !== "undefined"
        ? IPHONE_PRESET
        : Array.isArray(DEFAULT_PRESETS) && DEFAULT_PRESETS.length
          ? DEFAULT_PRESETS[0]
          : null;
    const preset = sourcePreset
      ? clone(sourcePreset)
      : {
          name: PRESET_NAME,
          params: clone(params),
          attractors: []
        };

    preset.name = PRESET_NAME;
    preset.params = Object.assign({}, preset.params || {}, {
      agentCount: typeof IPHONE_AGENT_COUNT === "number" ? IPHONE_AGENT_COUNT : 48,
      showImageFond: true,
      imageFondAlpha: 255,
      debugHeatmap: false,
      agentDrawEvery: 2,
      preloadClosed: false
    });
    return preset;
  }

  function upsertPresetInList(list) {
    if (!Array.isArray(list)) return -1;
    const existingIndex = list.findIndex(preset => preset && preset.name === PRESET_NAME);
    const preset = makePreset();
    if (existingIndex === -1) {
      list.push(preset);
      return list.length - 1;
    }
    list[existingIndex] = preset;
    return existingIndex;
  }

  function upsertPreset() {
    if (typeof DEFAULT_PRESETS !== "undefined") upsertPresetInList(DEFAULT_PRESETS);
    if (typeof presets !== "undefined") return upsertPresetInList(presets);
    return -1;
  }

  function activate() {
    state.active = true;
    state.startedAt = Date.now();
    state.completedAt = 0;
    state.grid = 0;
    state.total = 0;
    choosePhotoUrls();
    ensureGridState();
    params.agentCount = typeof IPHONE_AGENT_COUNT === "number" ? IPHONE_AGENT_COUNT : 48;
    params.showImageFond = true;
    params.imageFondAlpha = 255;
    params.debugHeatmap = false;
    params.agentDrawEvery = 2;
    if (typeof resetSketchCycle === "function") resetSketchCycle();
    if (window.gui) window.gui.updateDisplay();
  }

  function loadPreset() {
    const presetIndex = upsertPreset();
    if (presetIndex >= 0 && typeof applyPreset === "function") {
      const result = applyPreset(presetIndex, { notify: false, updateGui: true });
      if (result !== false && !isPresetActive()) activate();
    }
  }

  const previousApplyPreset = applyPreset;
  applyPreset = function applyPresetWithBackgroundRandom(index, options = {}) {
    const result = previousApplyPreset.apply(this, arguments);
    if (result !== false && Array.isArray(presets) && presets[index]?.name === PRESET_NAME) {
      activate();
    } else if (state.active && Array.isArray(presets) && presets[index]?.name !== PRESET_NAME) {
      state.active = false;
      if (typeof resetSketchCycle === "function") resetSketchCycle();
    }
    return result;
  };

  const previousGetBackgroundImageForCurrentPreset = getBackgroundImageForCurrentPreset;
  getBackgroundImageForCurrentPreset = function getBackgroundRandomImage() {
    if (!isPresetActive()) {
      return previousGetBackgroundImageForCurrentPreset.apply(this, arguments);
    }

    const primaryImage = getPrimaryImage();
    if (!primaryImage) return previousGetBackgroundImageForCurrentPreset.apply(this, arguments);

    const elapsed = Date.now() - state.startedAt;
    if (elapsed < MOSAIC_DELAY_MS) return primaryImage;

    if (state.completedAt) {
      if (!currentBlinkShowsAlternate()) return primaryImage;
      const alternateImage = getAlternateImage() || primaryImage;
      return getMosaicLayer(alternateImage, state.alternateMap, "alternateLayer", "alternateDirty");
    }

    return getMosaicLayer(primaryImage, state.primaryMap, "primaryLayer", "primaryDirty");
  };

  const previousDraw = draw;
  draw = function drawWithBackgroundRandomPreset() {
    if (!isPresetActive()) return previousDraw.apply(this, arguments);

    closedRequested = true;
    previousDraw.apply(this, arguments);
    drawActiveOverlay();
  };

  function installGuiButton() {
    if (!window.gui || window.gui.__displayPhotoBackgroundRandomButtonInstalled) return;
    window.gui.__displayPhotoBackgroundRandomButtonInstalled = true;
    window.gui
      .add({ displayPhotoBackgroundRandom: loadPreset }, "displayPhotoBackgroundRandom")
      .name(PRESET_NAME);
  }

  const previousSetupGUI = setupGUI;
  setupGUI = function setupGUIWithBackgroundRandomButton() {
    const result = previousSetupGUI.apply(this, arguments);
    installGuiButton();
    return result;
  };

  const previousSetupMobileControls = setupMobileControls;
  setupMobileControls = function setupMobileControlsWithBackgroundRandomButton() {
    const result = previousSetupMobileControls.apply(this, arguments);
    if (
      typeof shouldUseMobileControls === "function" &&
      shouldUseMobileControls() &&
      typeof addMobileControlButton === "function"
    ) {
      addMobileControlButton("Random", PRESET_NAME, loadPreset);
    }
    return result;
  };

  upsertPreset();
  installGuiButton();
  window.displayPhotoBackgroundRandomPreset = loadPreset;
})();
