/**
 * Canvas-independent portrait isolation. All geometry is in output pixels.
 * MediaPipe Selfie Multiclass classes: background 0, hair 1, body-skin 2,
 * face-skin 3, clothes 4, others/accessories 5. Body and clothes are excluded.
 * The complete face oval is retained regardless of a model's internal holes:
 * teeth, eyes, glasses and dark mouth interiors must not become background.
 */
export const PORTRAIT_HEAD_CLASSES = Object.freeze([1, 3, 5]);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 64_000_000) {
    throw new RangeError('Portrait dimensions must be positive integers, at most 64 million pixels.');
  }
}

function checkedPolygon(points) {
  if (!Array.isArray(points) || points.length < 3 || points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new TypeError('A finite, ordered face oval with at least three points is required.');
  }
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    twiceArea += p.x * q.y - q.x * p.y;
  }
  if (Math.abs(twiceArea) < 2) throw new RangeError('The face oval is degenerate.');
  return points.map(p => ({x:p.x, y:p.y}));
}

// Scanline rasterization samples pixel centres and leaves no rectangular crop.
function polygonMask(points, width, height) {
  const result = new Uint8Array(width * height);
  const startY = clamp(Math.floor(Math.min(...points.map(p => p.y))), 0, height);
  const endY = clamp(Math.ceil(Math.max(...points.map(p => p.y))), 0, height);
  for (let y = startY; y < endY; y++) {
    const sampleY = y + .5, crossings = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      if ((p.y > sampleY) !== (q.y > sampleY)) crossings.push(p.x + (sampleY - p.y) * (q.x - p.x) / (q.y - p.y));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const startX = clamp(Math.ceil(crossings[i] - .5), 0, width);
      const endX = clamp(Math.ceil(crossings[i + 1] - .5), 0, width);
      result.fill(1, y * width + startX, y * width + endX);
    }
  }
  return result;
}

function anatomicalHeadCap(oval, downAxis) {
  const length = Math.hypot(downAxis.x, downAxis.y);
  if (!Number.isFinite(length) || length < 1e-6) throw new TypeError('The down axis must be finite and nonzero.');
  const down = {x:downAxis.x / length, y:downAxis.y / length};
  const centre = oval.reduce((sum, p) => ({x:sum.x + p.x / oval.length, y:sum.y + p.y / oval.length}), {x:0, y:0});
  return oval.map(p => {
    const dx = p.x - centre.x, dy = p.y - centre.y, radius = Math.max(1e-6, Math.hypot(dx, dy));
    const signedDown = (dx * down.x + dy * down.y) / radius;
    const up = Math.max(0, -signedDown), below = Math.max(0, signedDown);
    const side = Math.sqrt(Math.max(0, 1 - signedDown * signedDown));
    // Hair above the forehead and ears can extend; below the chin the cap
    // contracts to the face contour, excluding neck, shoulders and shirt.
    const scale = clamp(1.12 + .68 * Math.pow(up, 1.4) + .18 * Math.pow(side, 1.7) - .10 * Math.pow(below, 1.3), 1.02, 1.82);
    return {x:centre.x + dx * scale, y:centre.y + dy * scale};
  });
}

function segmentationSampler(options, width, height) {
  const {headConfidence, confidenceMasks, categoryMask} = options;
  if (headConfidence == null && confidenceMasks == null && categoryMask == null) return null;
  const maskWidth = options.maskWidth ?? width, maskHeight = options.maskHeight ?? height;
  if (!Number.isInteger(maskWidth) || !Number.isInteger(maskHeight) || maskWidth < 1 || maskHeight < 1) return null;
  const count = maskWidth * maskHeight;
  const plane = headConfidence ?? null;
  const planes = confidenceMasks == null ? null : PORTRAIT_HEAD_CLASSES.map(id => confidenceMasks[id]);
  if (plane != null && plane.length !== count) return null;
  if (plane == null && planes != null && planes.some(data => !data || data.length !== count)) return null;
  if (plane == null && planes == null && (!categoryMask || categoryMask.length !== count)) return null;
  const value = index => {
    if (plane != null) return Number.isFinite(plane[index]) ? clamp(plane[index], 0, 1) : 0;
    if (planes != null) return clamp(planes.reduce((sum, data) => sum + (Number.isFinite(data[index]) ? data[index] : 0), 0), 0, 1);
    return PORTRAIT_HEAD_CLASSES.includes(categoryMask[index]) ? 1 : 0;
  };
  return (x, y) => {
    const mx = clamp((x + .5) * maskWidth / width - .5, 0, maskWidth - 1);
    const my = clamp((y + .5) * maskHeight / height - .5, 0, maskHeight - 1);
    const x0 = Math.floor(mx), y0 = Math.floor(my), x1 = Math.min(maskWidth - 1, x0 + 1), y1 = Math.min(maskHeight - 1, y0 + 1);
    const fx = mx - x0, fy = my - y0;
    return (1 - fy) * ((1 - fx) * value(y0 * maskWidth + x0) + fx * value(y0 * maskWidth + x1)) +
      fy * ((1 - fx) * value(y1 * maskWidth + x0) + fx * value(y1 * maskWidth + x1));
  };
}

// Only keep segmentation connected to the known face. This rejects other
// people, objects, detached hair specks and accessories in the background.
function faceConnected(candidate, face, width, height) {
  const result = new Uint8Array(candidate.length), queue = new Int32Array(candidate.length);
  let read = 0, write = 0;
  for (let i = 0; i < face.length; i++) if (face[i]) {result[i] = 1; queue[write++] = i;}
  while (read < write) {
    const at = queue[read++], x = at % width, y = Math.floor(at / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      const next = at + dy * width + dx;
      if (candidate[next] && !result[next]) {result[next] = 1; queue[write++] = next;}
    }
  }
  return result;
}

// Short inner feather only. The surrounding background remains exactly white,
// and most foreground pixels stay unmodified rather than being washed out by
// a broad blur. A chamfer distance suffices for this 1–3 pixel transition.
function featherInward(mask, width, height, radius) {
  const distance = new Float32Array(mask.length), diagonal = Math.SQRT2;
  for (let i = 0; i < mask.length; i++) distance[i] = mask[i] ? radius + 1 : 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!mask[i]) continue;
    let d = Math.min(distance[i], x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : radius + 1);
    if (x) d = Math.min(d, distance[i - 1] + 1);
    if (y) d = Math.min(d, distance[i - width] + 1);
    if (x && y) d = Math.min(d, distance[i - width - 1] + diagonal);
    if (x + 1 < width && y) d = Math.min(d, distance[i - width + 1] + diagonal);
    distance[i] = d;
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (!mask[i]) continue;
    let d = distance[i];
    if (x + 1 < width) d = Math.min(d, distance[i + 1] + 1);
    if (y + 1 < height) d = Math.min(d, distance[i + width] + 1);
    if (x + 1 < width && y + 1 < height) d = Math.min(d, distance[i + width + 1] + diagonal);
    if (x && y + 1 < height) d = Math.min(d, distance[i + width - 1] + diagonal);
    distance[i] = d;
  }
  const alpha = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const t = mask[i] ? clamp((distance[i] - .5) / radius, 0, 1) : 0;
    alpha[i] = 255 * t * t * (3 - 2 * t);
  }
  return alpha;
}

/**
 * Create an alpha mask for one head, anchored by an ordered face oval.
 * Optional segmentation input: headConfidence (one [0,1] plane), six
 * confidenceMasks in MediaPipe class order, or categoryMask. Specify
 * maskWidth/maskHeight when model resolution differs from the output.
 * Missing or unreliable segmentation uses the face oval and MUST expose the
 * returned warning to the user. Never substitute an old person's matte.
 */
export function createPortraitMatte(options) {
  const {width, height, faceOval} = options;
  dimensions(width, height);
  const oval = checkedPolygon(faceOval), face = polygonMask(oval, width, height);
  const facePixels = face.reduce((sum, value) => sum + value, 0);
  if (!facePixels) throw new RangeError('The face oval must intersect the image.');
  const radius = Number.isFinite(options.featherPx) ? clamp(options.featherPx, 1, 3) : 2;
  const sample = segmentationSampler(options, width, height);
  let mask = face, method = 'face-oval-fallback', warning = 'Détourage approximatif : segmentation indisponible, contour du visage utilisé.';
  if (sample) {
    const cap = polygonMask(anatomicalHeadCap(oval, options.downAxis ?? {x:0, y:1}), width, height);
    const candidate = new Uint8Array(face.length);
    let faceVotes = 0, imageVotes = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, foreground = sample(x, y) >= .45;
      if (foreground) {imageVotes++; if (face[i]) faceVotes++;}
      candidate[i] = face[i] || (cap[i] && foreground) ? 1 : 0;
    }
    if (faceVotes / facePixels >= .35 && imageVotes / face.length < .98) {
      mask = faceConnected(candidate, face, width, height);
      method = 'head-segmentation'; warning = '';
    } else warning = 'Détourage approximatif : segmentation incohérente, contour du visage utilisé.';
  }
  const alpha = featherInward(mask, width, height, radius);
  const foregroundPixels = mask.reduce((sum, value) => sum + value, 0);
  return {width, height, alpha, method, warning, coverage:foregroundPixels / mask.length, featherPx:radius};
}

/** Composite RGBA pixels onto opaque pure white; no canvas or source mutation. */
export function compositePortraitOnWhite(rgba, matte) {
  const {width, height, alpha} = matte;
  dimensions(width, height);
  if (!rgba || rgba.length !== width * height * 4 || !alpha || alpha.length !== width * height) {
    throw new RangeError('RGBA pixels and portrait matte must have matching dimensions.');
  }
  const output = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < alpha.length; i++) {
    const j = i * 4, opacity = alpha[i] / 255 * rgba[j + 3] / 255;
    for (let channel = 0; channel < 3; channel++) output[j + channel] = 255 + (rgba[j + channel] - 255) * opacity;
    output[j + 3] = 255;
  }
  return output;
}
