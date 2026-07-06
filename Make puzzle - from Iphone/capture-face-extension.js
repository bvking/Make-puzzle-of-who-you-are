// Extension capture-face : ajoute un preset sans agents et un bouton de capture photo.
(function installCaptureFaceExtension() {
  const CAPTURE_FACE_PRESET_NAME = "capture-face";
  const CAPTURE_FACE_TOTAL_PHOTOS = 10;
  const CAPTURE_FACE_INTERVAL_MS = 1000;

  let captureStream = null;
  let captureTimer = null;
  let captureInProgress = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeCaptureFacePreset() {
    const sourcePreset =
      typeof IPHONE_PRESET !== "undefined"
        ? IPHONE_PRESET
        : Array.isArray(DEFAULT_PRESETS) && DEFAULT_PRESETS.length
          ? DEFAULT_PRESETS[0]
          : null;

    const preset = sourcePreset
      ? clone(sourcePreset)
      : {
          name: CAPTURE_FACE_PRESET_NAME,
          params: clone(params),
          attractors: []
        };

    preset.name = CAPTURE_FACE_PRESET_NAME;
    preset.params = Object.assign({}, preset.params || {}, {
      agentCount: 0,
      showImageFond: true,
      imageFondAlpha: 55,
      debugHeatmap: false,
      agentDrawEvery: 1
    });

    return preset;
  }

  function upsertPresetInList(list) {
    if (!Array.isArray(list)) return -1;
    const existingIndex = list.findIndex(
      preset => preset && preset.name === CAPTURE_FACE_PRESET_NAME
    );
    const preset = makeCaptureFacePreset();
    if (existingIndex === -1) {
      list.push(preset);
      return list.length - 1;
    }
    list[existingIndex] = preset;
    return existingIndex;
  }

  function upsertCaptureFacePreset() {
    if (typeof DEFAULT_PRESETS !== "undefined") upsertPresetInList(DEFAULT_PRESETS);
    if (typeof presets !== "undefined") return upsertPresetInList(presets);
    return -1;
  }

  const originalNormalizeParamsObject = normalizeParamsObject;
  normalizeParamsObject = function normalizeParamsObjectWithCaptureFace(target) {
    const wantsZeroAgents = target && Number(target.agentCount) === 0;
    originalNormalizeParamsObject(target);
    if (wantsZeroAgents) target.agentCount = 0;
    return target;
  };

  function activateCaptureFacePreset() {
    const presetIndex = upsertCaptureFacePreset();
    if (presetIndex >= 0 && typeof applyPreset === "function") {
      applyPreset(presetIndex, { notify: false, updateGui: true });
    }

    params.agentCount = 0;
    if (Array.isArray(agents)) agents.length = 0;
    if (agentLayer) agentLayer.clear();
    if (typeof updateAgents === "function") updateAgents();
    if (window.gui) window.gui.updateDisplay();
  }

  function ensureCaptureStyles() {
    if (document.getElementById("capture-face-style")) return;
    const style = document.createElement("style");
    style.id = "capture-face-style";
    style.textContent = `
      .capture-face-panel {
        position: fixed;
        left: max(10px, env(safe-area-inset-left));
        right: max(10px, env(safe-area-inset-right));
        bottom: max(60px, calc(env(safe-area-inset-bottom) + 60px));
        z-index: 60;
        box-sizing: border-box;
        padding: 10px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.72);
        color: white;
        font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        pointer-events: auto;
      }
      .capture-face-panel video {
        display: block;
        width: 120px;
        max-width: 34vw;
        border-radius: 10px;
        margin-bottom: 8px;
        background: #111;
      }
      .capture-face-status {
        margin-bottom: 8px;
      }
      .capture-face-gallery {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 5px;
      }
      .capture-face-gallery img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 7px;
        background: #111;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCapturePanel() {
    ensureCaptureStyles();

    let panel = document.getElementById("capture-face-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "capture-face-panel";
      panel.className = "capture-face-panel";
      panel.innerHTML = `
        <video id="capture-face-video" playsinline muted autoplay></video>
        <div id="capture-face-status" class="capture-face-status">Capture prête.</div>
        <div id="capture-face-gallery" class="capture-face-gallery"></div>
      `;
      document.body.appendChild(panel);
    }

    return {
      panel,
      video: document.getElementById("capture-face-video"),
      status: document.getElementById("capture-face-status"),
      gallery: document.getElementById("capture-face-gallery")
    };
  }

  function stopCaptureStream() {
    if (captureTimer) {
      clearInterval(captureTimer);
      captureTimer = null;
    }
    if (captureStream) {
      for (const track of captureStream.getTracks()) track.stop();
      captureStream = null;
    }
    captureInProgress = false;
  }

  function addPhotoToGallery(video, gallery, count) {
    const size = Math.min(video.videoWidth || 800, video.videoHeight || 800);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const sx = Math.max(0, ((video.videoWidth || size) - size) / 2);
    const sy = Math.max(0, ((video.videoHeight || size) - size) / 2);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const img = document.createElement("img");
    img.alt = `capture ${count}`;
    img.src = canvas.toDataURL("image/jpeg", 0.86);
    gallery.appendChild(img);
  }

  async function startCaptureSequence() {
    if (captureInProgress) return;
    activateCaptureFacePreset();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("La capture caméra n'est pas disponible dans ce navigateur.");
      return;
    }

    const { video, status, gallery } = ensureCapturePanel();
    gallery.innerHTML = "";
    status.textContent = "Autorisation caméra en cours…";
    captureInProgress = true;

    try {
      captureStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      video.srcObject = captureStream;
      await video.play();

      let captured = 0;
      const captureOnePhoto = () => {
        captured += 1;
        addPhotoToGallery(video, gallery, captured);
        status.textContent = `Photo ${captured}/${CAPTURE_FACE_TOTAL_PHOTOS}`;

        if (captured >= CAPTURE_FACE_TOTAL_PHOTOS) {
          stopCaptureStream();
          status.textContent = "10 photos capturées et affichées.";
        }
      };

      captureOnePhoto();
      captureTimer = setInterval(captureOnePhoto, CAPTURE_FACE_INTERVAL_MS);
    } catch (err) {
      stopCaptureStream();
      status.textContent = "Capture annulée ou caméra refusée.";
      console.warn("Capture caméra impossible", err);
      alert("Impossible d'accéder à la caméra de l'iPhone.");
    }
  }

  function installCaptureGuiButton() {
    if (!window.gui || window.gui.__captureFaceButtonInstalled) return;
    window.gui.__captureFaceButtonInstalled = true;
    window.gui.add({ capture: startCaptureSequence }, "capture").name("capture");
  }

  upsertCaptureFacePreset();

  const originalSetupGUI = setupGUI;
  setupGUI = function setupGUIWithCaptureButton() {
    const result = originalSetupGUI.apply(this, arguments);
    installCaptureGuiButton();
    return result;
  };

  const originalSetupMobileControls = setupMobileControls;
  setupMobileControls = function setupMobileControlsWithCaptureButton() {
    const result = originalSetupMobileControls.apply(this, arguments);
    if (
      typeof shouldUseMobileControls === "function" &&
      shouldUseMobileControls() &&
      typeof addMobileControlButton === "function"
    ) {
      addMobileControlButton("Capture", "Prendre 10 photos", startCaptureSequence);
    }
    return result;
  };

  window.captureFace = startCaptureSequence;
})();
