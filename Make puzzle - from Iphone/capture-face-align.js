// Extension capture-face : ajoute un preset sans agents et un bouton de capture photo.
// Les photos sont traitées côté navigateur : repères du visage, alignement des yeux,
// masque ovale du visage et affichage des 10 captures détourées.
(function installCaptureFaceExtension() {
  const CAPTURE_FACE_PRESET_NAME = "capture-face";
  const CAPTURE_FACE_TOTAL_PHOTOS = 10;
  const CAPTURE_FACE_INTERVAL_MS = 1000;
  const CAPTURE_FACE_OUTPUT_SIZE = 512;
  const CAPTURE_FACE_PANEL_HIDE_DELAY_MS = 700;
  const CAPTURE_FACE_STORAGE_KEY = "captureFaceAlignedPhotos";
  const TARGET_EYE_Y_RATIO = 0.38;
  const TARGET_EYE_DISTANCE_RATIO = 0.34;
  const FACE_MASK_SCALE = 1.12;
  const FACE_MASK_FEATHER_PX = 8;

  const FACE_MESH_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
  const FACE_MESH_ASSET_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh";

  const FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];
  const LEFT_EYE_INDICES = [33, 133, 159, 145, 153, 154, 155, 173];
  const RIGHT_EYE_INDICES = [263, 362, 386, 374, 380, 381, 382, 398];

  let captureStream = null;
  let captureTimer = null;
  let capturePanelHideTimer = null;
  let captureInProgress = false;
  let faceMeshInstance = null;
  let faceMeshLoadingPromise = null;

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
        bottom: max(66px, calc(env(safe-area-inset-bottom) + 66px));
        z-index: 60;
        box-sizing: border-box;
        padding: 10px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.76);
        color: white;
        font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        pointer-events: auto;
        transition: opacity 220ms ease, transform 220ms ease;
      }
      .capture-face-panel.is-hiding {
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
      }
      .capture-face-preview-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .capture-face-panel video {
        display: block;
        width: 118px;
        max-width: 34vw;
        border-radius: 10px;
        background: #111;
        transform: scaleX(-1);
      }
      .capture-face-status {
        flex: 1;
        min-width: 0;
      }
      .capture-face-gallery {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 5px;
      }
      .capture-face-gallery img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: contain;
        border-radius: 8px;
        background: radial-gradient(circle at center, rgba(255,255,255,0.14), rgba(0,0,0,0.84));
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCapturePanel() {
    ensureCaptureStyles();
    if (capturePanelHideTimer) {
      window.clearTimeout(capturePanelHideTimer);
      capturePanelHideTimer = null;
    }

    let panel = document.getElementById("capture-face-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "capture-face-panel";
      panel.className = "capture-face-panel";
      panel.innerHTML = `
        <div class="capture-face-preview-row">
          <video id="capture-face-video" playsinline muted autoplay></video>
          <div id="capture-face-status" class="capture-face-status">Capture prête.</div>
        </div>
        <div id="capture-face-gallery" class="capture-face-gallery"></div>
      `;
      document.body.appendChild(panel);
    }
    panel.classList.remove("is-hiding");

    return {
      panel,
      video: document.getElementById("capture-face-video"),
      status: document.getElementById("capture-face-status"),
      gallery: document.getElementById("capture-face-gallery")
    };
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureFaceMesh(status) {
    if (faceMeshInstance) return faceMeshInstance;
    if (faceMeshLoadingPromise) return faceMeshLoadingPromise;

    faceMeshLoadingPromise = (async () => {
      if (status) status.textContent = "Chargement de la détection du visage…";
      if (typeof FaceMesh === "undefined") await loadScriptOnce(FACE_MESH_URL);
      if (typeof FaceMesh === "undefined") {
        throw new Error("FaceMesh n'est pas disponible");
      }

      const mesh = new FaceMesh({
        locateFile: file => `${FACE_MESH_ASSET_URL}/${file}`
      });
      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      faceMeshInstance = mesh;
      return faceMeshInstance;
    })();

    return faceMeshLoadingPromise;
  }

  async function detectFaceLandmarks(video, status) {
    const mesh = await ensureFaceMesh(status);
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 1800);

      mesh.onResults(results => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        const landmarks =
          results && results.multiFaceLandmarks && results.multiFaceLandmarks.length
            ? results.multiFaceLandmarks[0]
            : null;
        resolve(landmarks);
      });

      mesh.send({ image: video }).catch(err => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function averageLandmarks(landmarks, indices, videoWidth, videoHeight) {
    const total = indices.reduce(
      (acc, index) => {
        const point = landmarks[index];
        if (!point) return acc;
        acc.x += point.x * videoWidth;
        acc.y += point.y * videoHeight;
        acc.count += 1;
        return acc;
      },
      { x: 0, y: 0, count: 0 }
    );

    if (!total.count) return null;
    return { x: total.x / total.count, y: total.y / total.count };
  }

  function makeAlignment(landmarks, videoWidth, videoHeight, outputSize) {
    const eyeA = averageLandmarks(landmarks, LEFT_EYE_INDICES, videoWidth, videoHeight);
    const eyeB = averageLandmarks(landmarks, RIGHT_EYE_INDICES, videoWidth, videoHeight);
    if (!eyeA || !eyeB) return null;

    const sourceLeftEye = eyeA.x <= eyeB.x ? eyeA : eyeB;
    const sourceRightEye = eyeA.x <= eyeB.x ? eyeB : eyeA;
    const sourceEyeMid = {
      x: (sourceLeftEye.x + sourceRightEye.x) / 2,
      y: (sourceLeftEye.y + sourceRightEye.y) / 2
    };
    const sourceEyeDistance = Math.hypot(
      sourceRightEye.x - sourceLeftEye.x,
      sourceRightEye.y - sourceLeftEye.y
    );
    if (!sourceEyeDistance) return null;

    const targetEyeDistance = outputSize * TARGET_EYE_DISTANCE_RATIO;
    const scale = targetEyeDistance / sourceEyeDistance;
    const angle = Math.atan2(
      sourceRightEye.y - sourceLeftEye.y,
      sourceRightEye.x - sourceLeftEye.x
    );
    const rotation = -angle;
    const targetEyeMid = {
      x: outputSize / 2,
      y: outputSize * TARGET_EYE_Y_RATIO
    };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      scale,
      rotation,
      sourceEyeMid,
      targetEyeMid,
      transformPoint(point) {
        const dx = point.x - sourceEyeMid.x;
        const dy = point.y - sourceEyeMid.y;
        return {
          x: targetEyeMid.x + scale * (dx * cos - dy * sin),
          y: targetEyeMid.y + scale * (dx * sin + dy * cos)
        };
      }
    };
  }

  function drawSmoothClosedPath(ctx, points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mid = {
        x: (points[i].x + points[i + 1].x) / 2,
        y: (points[i].y + points[i + 1].y) / 2
      };
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }
    const last = points[points.length - 1];
    ctx.quadraticCurveTo(last.x, last.y, points[0].x, points[0].y);
    ctx.closePath();
  }

  function makeFaceMask(landmarks, alignment, videoWidth, videoHeight, outputSize) {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = outputSize;
    maskCanvas.height = outputSize;
    const maskCtx = maskCanvas.getContext("2d");

    let points = FACE_OVAL_INDICES
      .map(index => landmarks[index])
      .filter(Boolean)
      .map(point => alignment.transformPoint({
        x: point.x * videoWidth,
        y: point.y * videoHeight
      }));

    if (!points.length) return maskCanvas;

    const center = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );
    center.x /= points.length;
    center.y /= points.length;

    points = points.map(point => ({
      x: center.x + (point.x - center.x) * FACE_MASK_SCALE,
      y: center.y + (point.y - center.y) * FACE_MASK_SCALE
    }));

    maskCtx.save();
    maskCtx.fillStyle = "white";
    maskCtx.filter = `blur(${FACE_MASK_FEATHER_PX}px)`;
    drawSmoothClosedPath(maskCtx, points);
    maskCtx.fill();
    maskCtx.restore();

    maskCtx.save();
    maskCtx.fillStyle = "white";
    drawSmoothClosedPath(maskCtx, points);
    maskCtx.fill();
    maskCtx.restore();

    return maskCanvas;
  }

  function makeFallbackCrop(video) {
    const outputSize = CAPTURE_FACE_OUTPUT_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    const sourceSize = Math.min(video.videoWidth || outputSize, video.videoHeight || outputSize);
    const sx = Math.max(0, ((video.videoWidth || sourceSize) - sourceSize) / 2);
    const sy = Math.max(0, ((video.videoHeight || sourceSize) - sourceSize) / 2);

    ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
    ctx.globalCompositeOperation = "destination-in";
    const gradient = ctx.createRadialGradient(
      outputSize / 2,
      outputSize * 0.46,
      outputSize * 0.22,
      outputSize / 2,
      outputSize * 0.46,
      outputSize * 0.46
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.72, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(
      outputSize / 2,
      outputSize * 0.48,
      outputSize * 0.34,
      outputSize * 0.43,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    return canvas.toDataURL("image/png");
  }

  async function makeAlignedFaceCapture(video, status) {
    const outputSize = CAPTURE_FACE_OUTPUT_SIZE;
    const videoWidth = video.videoWidth || 0;
    const videoHeight = video.videoHeight || 0;
    if (!videoWidth || !videoHeight) return makeFallbackCrop(video);

    const landmarks = await detectFaceLandmarks(video, status);
    if (!landmarks) {
      if (status) status.textContent = "Visage non détecté : centrage approximatif.";
      return makeFallbackCrop(video);
    }

    const alignment = makeAlignment(landmarks, videoWidth, videoHeight, outputSize);
    if (!alignment) return makeFallbackCrop(video);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.translate(alignment.targetEyeMid.x, alignment.targetEyeMid.y);
    ctx.rotate(alignment.rotation);
    ctx.scale(alignment.scale, alignment.scale);
    ctx.translate(-alignment.sourceEyeMid.x, -alignment.sourceEyeMid.y);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    ctx.restore();

    const maskCanvas = makeFaceMask(landmarks, alignment, videoWidth, videoHeight, outputSize);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    return canvas.toDataURL("image/png");
  }

  function stopCaptureStream() {
    if (captureTimer) {
      window.clearTimeout(captureTimer);
      captureTimer = null;
    }
    if (captureStream) {
      for (const track of captureStream.getTracks()) track.stop();
      captureStream = null;
    }
    captureInProgress = false;
  }

  function waitForNextCapture() {
    return new Promise(resolve => {
      captureTimer = window.setTimeout(() => {
        captureTimer = null;
        resolve();
      }, CAPTURE_FACE_INTERVAL_MS);
    });
  }

  function addPhotoToGallery(dataUrl, gallery, count) {
    const img = document.createElement("img");
    img.alt = `capture visage ${count}`;
    img.src = dataUrl;
    gallery.appendChild(img);
  }

  function saveCapturedGallery(gallery) {
    const urls = Array.from(gallery.querySelectorAll("img"))
      .map(image => image && image.src)
      .filter(src => src && src.startsWith("data:image/"))
      .slice(-CAPTURE_FACE_TOTAL_PHOTOS);

    try {
      localStorage.setItem(CAPTURE_FACE_STORAGE_KEY, JSON.stringify(urls));
    } catch (err) {
      console.warn("Impossible de sauvegarder les visages captures", err);
    }
  }

  function hideCapturePanelAfterComplete(panel) {
    if (capturePanelHideTimer) window.clearTimeout(capturePanelHideTimer);
    capturePanelHideTimer = window.setTimeout(() => {
      capturePanelHideTimer = null;
      if (!panel || !panel.isConnected) return;
      panel.classList.add("is-hiding");
      window.setTimeout(() => {
        if (panel.isConnected && panel.classList.contains("is-hiding")) {
          panel.remove();
        }
      }, 260);
    }, CAPTURE_FACE_PANEL_HIDE_DELAY_MS);
  }

  async function startCaptureSequence() {
    if (captureInProgress) return;
    activateCaptureFacePreset();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("La capture caméra n'est pas disponible dans ce navigateur.");
      return;
    }

    const { panel, video, status, gallery } = ensureCapturePanel();
    gallery.innerHTML = "";
    status.textContent = "Autorisation caméra en cours…";
    captureInProgress = true;

    try {
      captureStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        },
        audio: false
      });
      video.srcObject = captureStream;
      await video.play();
      await ensureFaceMesh(status);

      for (let captured = 1; captured <= CAPTURE_FACE_TOTAL_PHOTOS; captured++) {
        if (!captureInProgress) break;
        status.textContent = `Photo ${captured}/${CAPTURE_FACE_TOTAL_PHOTOS} : détection et détourage…`;
        const dataUrl = await makeAlignedFaceCapture(video, status);
        addPhotoToGallery(dataUrl, gallery, captured);
        status.textContent = `Photo ${captured}/${CAPTURE_FACE_TOTAL_PHOTOS} affichée. Yeux alignés.`;
        if (captured < CAPTURE_FACE_TOTAL_PHOTOS) await waitForNextCapture();
      }

      stopCaptureStream();
      saveCapturedGallery(gallery);
      status.textContent = "10 visages détourés, centrés et affichés.";
      hideCapturePanelAfterComplete(panel);
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
      addMobileControlButton("Capture", "Prendre 10 visages détourés", startCaptureSequence);
    }
    return result;
  };

  window.captureFace = startCaptureSequence;
})();
