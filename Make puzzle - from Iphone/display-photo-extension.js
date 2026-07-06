// Extension display-photo : affiche les visages capturés comme fond animé.
// Les images utilisées sont celles produites par capture-face-align.js : visage détouré,
// yeux alignés, image carrée centrée. Le preset display-photo les affiche en boucle.
(function installDisplayPhotoExtension() {
  const DISPLAY_PHOTO_PRESET_NAME = "display-photo";
  const DISPLAY_PHOTO_INTERVAL_MS = 1000;
  const DISPLAY_PHOTO_STORAGE_KEY = "captureFaceAlignedPhotos";
  const MAX_DISPLAY_PHOTOS = 10;

  let displayPhotoUrls = [];
  let displayStartTime = Date.now();
  const imageCache = new Map();

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
    return unique.slice(-MAX_DISPLAY_PHOTOS);
  }

  function readStoredPhotoUrls() {
    try {
      const raw = localStorage.getItem(DISPLAY_PHOTO_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (err) {
      console.warn("Photos display-photo ignorées depuis localStorage", err);
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

  function savePhotoUrls(urls) {
    try {
      localStorage.setItem(DISPLAY_PHOTO_STORAGE_KEY, JSON.stringify(urls));
    } catch (err) {
      console.warn("Impossible de sauvegarder les photos display-photo", err);
    }
  }

  function sameList(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function syncPhotoUrls() {
    const nextUrls = uniqueLastTen([
      ...readStoredPhotoUrls(),
      ...readGalleryPhotoUrls()
    ]);

    if (!sameList(displayPhotoUrls, nextUrls)) {
      displayPhotoUrls = nextUrls;
      savePhotoUrls(displayPhotoUrls);
      preloadDisplayImages();
    }

    return displayPhotoUrls;
  }

  function ensureP5Image(url) {
    const cached = imageCache.get(url);
    if (cached && cached.state === "loaded") return cached.image;
    if (cached && cached.state === "loading") return null;

    if (typeof loadImage !== "function") return null;

    imageCache.set(url, { state: "loading", image: null });
    loadImage(
      url,
      loaded => {
        imageCache.set(url, { state: "loaded", image: loaded });
      },
      err => {
        imageCache.delete(url);
        console.warn("Impossible de charger une photo display-photo", err);
      }
    );
    return null;
  }

  function preloadDisplayImages() {
    for (const url of displayPhotoUrls) ensureP5Image(url);
  }

  function getLoadedDisplayImages() {
    syncPhotoUrls();
    return displayPhotoUrls
      .map(url => ensureP5Image(url))
      .filter(Boolean);
  }

  function getCurrentDisplayPhotoImage() {
    const images = getLoadedDisplayImages();
    if (!images.length) return null;
    const elapsed = Date.now() - displayStartTime;
    const index = Math.floor(elapsed / DISPLAY_PHOTO_INTERVAL_MS) % images.length;
    return images[index];
  }

  function makeDisplayPhotoPreset() {
    const sourcePreset =
      typeof IPHONE_PRESET !== "undefined"
        ? IPHONE_PRESET
        : Array.isArray(DEFAULT_PRESETS) && DEFAULT_PRESETS.length
          ? DEFAULT_PRESETS[0]
          : null;

    const preset = sourcePreset
      ? clone(sourcePreset)
      : {
          name: DISPLAY_PHOTO_PRESET_NAME,
          params: clone(params),
          attractors: []
        };

    preset.name = DISPLAY_PHOTO_PRESET_NAME;
    preset.params = Object.assign({}, preset.params || {}, {
      agentCount: 0,
      showImageFond: true,
      imageFondAlpha: 255,
      debugHeatmap: false,
      agentDrawEvery: 1
    });

    return preset;
  }

  function upsertPresetInList(list) {
    if (!Array.isArray(list)) return -1;
    const existingIndex = list.findIndex(
      preset => preset && preset.name === DISPLAY_PHOTO_PRESET_NAME
    );
    const preset = makeDisplayPhotoPreset();
    if (existingIndex === -1) {
      list.push(preset);
      return list.length - 1;
    }
    list[existingIndex] = preset;
    return existingIndex;
  }

  function upsertDisplayPhotoPreset() {
    if (typeof DEFAULT_PRESETS !== "undefined") upsertPresetInList(DEFAULT_PRESETS);
    if (typeof presets !== "undefined") return upsertPresetInList(presets);
    return -1;
  }

  function isDisplayPhotoPresetActive() {
    return (
      typeof activePresetIndex !== "undefined" &&
      activePresetIndex >= 0 &&
      Array.isArray(presets) &&
      presets[activePresetIndex] &&
      presets[activePresetIndex].name === DISPLAY_PHOTO_PRESET_NAME
    );
  }

  function activateDisplayPhotoMode() {
    displayStartTime = Date.now();
    syncPhotoUrls();
    params.agentCount = 0;
    params.showImageFond = true;
    params.imageFondAlpha = 255;
    params.debugHeatmap = false;
    if (Array.isArray(agents)) agents.length = 0;
    if (agentLayer) agentLayer.clear();
    if (typeof updateAgents === "function") updateAgents();
    params.agentCount = 0;
    params.imageFondAlpha = 255;
    if (window.gui) window.gui.updateDisplay();
  }

  function loadDisplayPhotoPreset() {
    const presetIndex = upsertDisplayPhotoPreset();
    if (presetIndex >= 0 && typeof applyPreset === "function") {
      applyPreset(presetIndex, { notify: false, updateGui: true });
      activateDisplayPhotoMode();
    }
  }

  const previousNormalizeParamsObject = normalizeParamsObject;
  normalizeParamsObject = function normalizeParamsObjectWithDisplayPhoto(target) {
    const wantsZeroAgents = target && Number(target.agentCount) === 0;
    previousNormalizeParamsObject(target);
    if (wantsZeroAgents) target.agentCount = 0;
    return target;
  };

  const previousApplyPreset = applyPreset;
  applyPreset = function applyPresetWithDisplayPhoto(index, options = {}) {
    const result = previousApplyPreset.apply(this, arguments);
    if (result !== false && isDisplayPhotoPresetActive()) {
      activateDisplayPhotoMode();
    }
    return result;
  };

  const previousGetBackgroundImageForCurrentPreset = getBackgroundImageForCurrentPreset;
  getBackgroundImageForCurrentPreset = function getDisplayPhotoBackgroundImage() {
    if (isDisplayPhotoPresetActive()) {
      const photoImage = getCurrentDisplayPhotoImage();
      if (photoImage) return photoImage;
    }
    return previousGetBackgroundImageForCurrentPreset.apply(this, arguments);
  };

  function installDisplayGuiButton() {
    if (!window.gui || window.gui.__displayPhotoButtonInstalled) return;
    window.gui.__displayPhotoButtonInstalled = true;
    window.gui.add({ displayPhoto: loadDisplayPhotoPreset }, "displayPhoto").name("display-photo");
  }

  const previousSetupGUI = setupGUI;
  setupGUI = function setupGUIWithDisplayPhotoButton() {
    const result = previousSetupGUI.apply(this, arguments);
    installDisplayGuiButton();
    return result;
  };

  const previousSetupMobileControls = setupMobileControls;
  setupMobileControls = function setupMobileControlsWithDisplayButton() {
    const result = previousSetupMobileControls.apply(this, arguments);
    if (
      typeof shouldUseMobileControls === "function" &&
      shouldUseMobileControls() &&
      typeof addMobileControlButton === "function"
    ) {
      addMobileControlButton("Display", "Afficher les photos capturées", loadDisplayPhotoPreset);
    }
    return result;
  };

  function startGalleryObserver() {
    const attachObserver = () => {
      const gallery = document.getElementById("capture-face-gallery");
      if (!gallery || gallery.__displayPhotoObserverAttached) return;
      gallery.__displayPhotoObserverAttached = true;
      const observer = new MutationObserver(syncPhotoUrls);
      observer.observe(gallery, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"]
      });
      syncPhotoUrls();
    };

    attachObserver();
    window.setInterval(attachObserver, 800);
    if (document.body) {
      const bodyObserver = new MutationObserver(attachObserver);
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", attachObserver, { once: true });
    }
  }

  upsertDisplayPhotoPreset();
  syncPhotoUrls();
  startGalleryObserver();
  window.displayPhotoPreset = loadDisplayPhotoPreset;
})();
