const EPSILON = 1e-8;

export const POSE_BINS = Object.freeze([-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72]);

export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function quantile(values, part) {
  if (!values?.length) return 0;
  const sorted = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = clamp(part) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(sorted.length - 1, low + 1);
  const mix = position - low;
  return sorted[low] * (1 - mix) + sorted[high] * mix;
}

function srgbLuminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function analyzePhotometry(rgba, stride = 4) {
  if (!rgba?.length) {
    return { mean: 0, median: 0, p10: 0, p90: 0, contrast: 0, darkClip: 1, lightClip: 0, usable: false };
  }
  const values = [];
  let sum = 0;
  let dark = 0;
  let light = 0;
  for (let index = 0; index + 2 < rgba.length; index += Math.max(4, stride)) {
    const alpha = rgba[index + 3] ?? 255;
    if (alpha < 32) continue;
    const luminance = srgbLuminance(rgba[index], rgba[index + 1], rgba[index + 2]);
    values.push(luminance);
    sum += luminance;
    if (luminance <= 0.018) dark++;
    if (luminance >= 0.982) light++;
  }
  const count = Math.max(1, values.length);
  const p10 = quantile(values, 0.1);
  const p90 = quantile(values, 0.9);
  return {
    mean: sum / count,
    median: quantile(values, 0.5),
    p10,
    p90,
    contrast: p90 - p10,
    darkClip: dark / count,
    lightClip: light / count,
    usable: values.length >= 64,
  };
}

export function laplacianVariance(gray, width, height) {
  if (!gray?.length || width < 3 || height < 3 || gray.length < width * height) return 0;
  let sum = 0;
  let sumSquared = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const index = row + x;
      const value = 4 * gray[index] - gray[index - 1] - gray[index + 1] - gray[index - width] - gray[index + width];
      sum += value;
      sumSquared += value * value;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return Math.max(0, sumSquared / count - mean * mean);
}

function averageLandmarks(landmarks, ids) {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const id of ids) {
    const point = landmarks?.[id];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    x += point.x;
    y += point.y;
    z += Number.isFinite(point.z) ? point.z : 0;
    count++;
  }
  return count ? { x: x / count, y: y / count, z: z / count } : null;
}

function distance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

export function derivePose(landmarks, faceOval = []) {
  if (!landmarks || landmarks.length < 468) return null;
  const eyes = [averageLandmarks(landmarks, [33, 133]), averageLandmarks(landmarks, [362, 263])]
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);
  if (eyes.length !== 2) return null;
  const origin = { x: (eyes[0].x + eyes[1].x) / 2, y: (eyes[0].y + eyes[1].y) / 2 };
  const interocular = Math.max(EPSILON, distance(eyes[0], eyes[1]));
  const ux = (eyes[1].x - eyes[0].x) / interocular;
  const uy = (eyes[1].y - eyes[0].y) / interocular;
  let vx = -uy;
  let vy = ux;
  const chin = landmarks[152];
  if (((chin.x - origin.x) * vx + (chin.y - origin.y) * vy) < 0) {
    vx *= -1;
    vy *= -1;
  }
  const local = (point) => ({
    x: ((point.x - origin.x) * ux + (point.y - origin.y) * uy) / interocular,
    y: ((point.x - origin.x) * vx + (point.y - origin.y) * vy) / interocular,
  });
  const nose = local(landmarks[1]);
  const leftCheek = local(landmarks[234]);
  const rightCheek = local(landmarks[454]);
  const mouthCenterPoint = averageLandmarks(landmarks, [13, 14, 61, 291]);
  const mouthCenter = local(mouthCenterPoint);
  const mouthWidth = Math.max(EPSILON, distance(landmarks[61], landmarks[291]));
  const mouthOpen = distance(landmarks[13], landmarks[14]) / mouthWidth;
  const mouthCorners = averageLandmarks(landmarks, [61, 291]);
  const mouthCurve = (local(averageLandmarks(landmarks, [13, 14])).y - local(mouthCorners).y) / Math.max(0.05, mouthWidth / interocular);
  const eyeOpen = [
    (distance(landmarks[159], landmarks[145]) + distance(landmarks[158], landmarks[153])) / Math.max(EPSILON, 2 * distance(landmarks[33], landmarks[133])),
    (distance(landmarks[386], landmarks[374]) + distance(landmarks[387], landmarks[373])) / Math.max(EPSILON, 2 * distance(landmarks[362], landmarks[263])),
  ];
  const cheekLeft = Math.abs(leftCheek.x - nose.x);
  const cheekRight = Math.abs(rightCheek.x - nose.x);
  const cheekAsymmetry = (cheekLeft - cheekRight) / Math.max(0.05, cheekLeft + cheekRight);
  const yaw = clamp(nose.x * 1.45 + cheekAsymmetry * 0.85, -1, 1);
  const pitch = clamp((nose.y - 0.73) * 1.15 + (mouthCenter.y - 1.22) * 0.3, -1, 1);
  const ovalPoints = faceOval.map((id) => landmarks[id]).filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
  const xs = ovalPoints.map((point) => point.x);
  const ys = ovalPoints.map((point) => point.y);
  const inFrame = ovalPoints.length
    ? ovalPoints.filter((point) => point.x >= 0.005 && point.x <= 0.995 && point.y >= 0.005 && point.y <= 0.995).length / ovalPoints.length
    : 0;
  return {
    yaw,
    pitch,
    roll: Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x),
    scale: interocular,
    mouthOpen,
    mouthCurve,
    eyeOpen,
    cheekAsymmetry,
    inFrame,
    width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
  };
}

export function captureQuality({ pose, photometry, sharpness = 0 }) {
  const reasons = [];
  if (!pose) reasons.push('visage non détecté');
  if (!photometry?.usable) reasons.push('image illisible');
  if (pose) {
    if (pose.inFrame < 0.88) reasons.push('front, menton ou joue hors cadre');
    if (pose.width < 0.14 || pose.height < 0.2) reasons.push('visage trop petit');
    if (pose.width > 0.96 || pose.height > 1.04) reasons.push('visage trop proche');
  }
  if (photometry?.usable) {
    if (photometry.median < 0.065) reasons.push('visage trop sombre');
    if (photometry.median > 0.93) reasons.push('visage surexposé');
    if (photometry.darkClip > 0.34) reasons.push('ombres bouchées');
    if (photometry.lightClip > 0.26) reasons.push('hautes lumières brûlées');
    if (photometry.contrast < 0.035) reasons.push('contraste insuffisant');
  }
  if (sharpness > 0 && sharpness < 0.00018) reasons.push('image floue ou en mouvement');

  const framing = pose ? clamp((pose.inFrame - 0.75) / 0.25) : 0;
  const scale = pose ? Math.exp(-Math.abs(Math.log(Math.max(EPSILON, pose.scale) / 0.22)) * 0.42) : 0;
  const exposure = photometry?.usable ? Math.exp(-Math.abs(photometry.median - 0.48) * 1.35) : 0;
  const clipping = photometry?.usable ? clamp(1 - photometry.darkClip * 1.7 - photometry.lightClip * 2.2) : 0;
  const contrast = photometry?.usable ? clamp(photometry.contrast / 0.42) : 0;
  const focus = sharpness > 0 ? clamp(Math.log1p(sharpness * 9000) / 3.2) : 0.65;
  const score = 100 * (0.24 * framing + 0.16 * scale + 0.2 * exposure + 0.16 * clipping + 0.1 * contrast + 0.14 * focus);
  return { ok: reasons.length === 0, reasons, score: Math.round(clamp(score, 0, 100) * 10) / 10 };
}

export function poseBin(yaw, bins = POSE_BINS) {
  let best = 0;
  let distance = Infinity;
  bins.forEach((center, index) => {
    const candidate = Math.abs(yaw - center);
    if (candidate < distance) {
      distance = candidate;
      best = index;
    }
  });
  return best;
}

export function retainBestByPose(candidates, incoming, { bins = POSE_BINS, perBin = 2 } = {}) {
  const bin = poseBin(incoming.pose?.yaw ?? 0, bins);
  const grouped = candidates.concat({ ...incoming, poseBin: bin }).reduce((map, candidate) => {
    const key = Number.isInteger(candidate.poseBin) ? candidate.poseBin : poseBin(candidate.pose?.yaw ?? 0, bins);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...candidate, poseBin: key });
    return map;
  }, new Map());
  return [...grouped.values()]
    .flatMap((entries) => entries.sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0)).slice(0, perBin))
    .sort((a, b) => a.poseBin - b.poseBin || (b.quality?.score ?? 0) - (a.quality?.score ?? 0));
}

function expressionDistance(a, b) {
  if (!a?.pose || !b?.pose) return 1;
  const eyeA = (a.pose.eyeOpen?.[0] ?? 0) + (a.pose.eyeOpen?.[1] ?? 0);
  const eyeB = (b.pose.eyeOpen?.[0] ?? 0) + (b.pose.eyeOpen?.[1] ?? 0);
  const blendA = new Map((a.blendshapes ?? []).map((entry) => [entry.name, entry.score]));
  const blendB = new Map((b.blendshapes ?? []).map((entry) => [entry.name, entry.score]));
  const names = [...new Set([...blendA.keys(), ...blendB.keys()])].filter((name) => name && name !== '_neutral');
  const blendDistance = names.length
    ? names.reduce((sum, name) => sum + Math.abs((blendA.get(name) ?? 0) - (blendB.get(name) ?? 0)), 0) / names.length
    : 0;
  return Math.abs(a.pose.mouthOpen - b.pose.mouthOpen) * 2.2
    + Math.abs(a.pose.mouthCurve - b.pose.mouthCurve) * 0.7
    + Math.abs(eyeA - eyeB) * 0.55
    + blendDistance * 1.35;
}

export function pairCost(a, b, { targetYaw = null, preserveExpressionDifference = false } = {}) {
  if (!a?.pose || !b?.pose) return Infinity;
  const yawDifference = Math.abs(a.pose.yaw - b.pose.yaw);
  const pitchDifference = Math.abs(a.pose.pitch - b.pose.pitch);
  const rollDifference = Math.abs(Math.atan2(Math.sin(a.pose.roll - b.pose.roll), Math.cos(a.pose.roll - b.pose.roll))) / Math.PI;
  const scaleDifference = Math.abs(Math.log(Math.max(EPSILON, a.pose.scale) / Math.max(EPSILON, b.pose.scale)));
  const target = Number.isFinite(targetYaw)
    ? (Math.abs(a.pose.yaw - targetYaw) + Math.abs(b.pose.yaw - targetYaw)) * 1.75
    : (Math.abs(a.pose.yaw) + Math.abs(b.pose.yaw)) * 0.18;
  const expression = preserveExpressionDifference ? 0 : expressionDistance(a, b);
  const exposureDifference = Math.abs((a.photometry?.median ?? 0.5) - (b.photometry?.median ?? 0.5));
  const qualityReward = ((a.quality?.score ?? 0) + (b.quality?.score ?? 0)) / 200;
  return yawDifference * 6.2 + pitchDifference * 1.8 + rollDifference * 1.2 + scaleDifference * 0.22
    + expression * 0.8 + exposureDifference * 0.08 + target - qualityReward * 0.9;
}

export function chooseMatchedPair(first, second, options = {}) {
  let best = null;
  for (const a of first ?? []) {
    for (const b of second ?? []) {
      if (Number.isFinite(options.maxPoseGap) && Math.abs((a.pose?.yaw ?? Infinity) - (b.pose?.yaw ?? -Infinity)) > options.maxPoseGap) continue;
      const cost = pairCost(a, b, options);
      if (!Number.isFinite(cost)) continue;
      if (!best || cost < best.cost) best = { first: a, second: b, cost };
    }
  }
  if (!best) return null;
  const poseGap = Math.abs(best.first.pose.yaw - best.second.pose.yaw);
  return { ...best, poseGap, confidence: clamp(1 - best.cost / 5.5) };
}

export function commonYawRange(first, second) {
  const valuesA = (first ?? []).map((entry) => entry.pose?.yaw).filter(Number.isFinite);
  const valuesB = (second ?? []).map((entry) => entry.pose?.yaw).filter(Number.isFinite);
  if (!valuesA.length || !valuesB.length) return null;
  const minimum = Math.max(Math.min(...valuesA), Math.min(...valuesB));
  const maximum = Math.min(Math.max(...valuesA), Math.max(...valuesB));
  return minimum <= maximum ? { minimum, maximum } : null;
}

export function automaticHarmony(reference, source) {
  if (!reference?.usable || !source?.usable) return 0;
  const exposure = Math.abs(reference.median - source.median);
  const contrast = Math.abs(Math.log(Math.max(0.02, reference.contrast) / Math.max(0.02, source.contrast)));
  const clipping = Math.max(reference.darkClip, reference.lightClip, source.darkClip, source.lightClip);
  if (clipping > 0.35) return 0;
  return clamp((exposure - 0.025) * 3.6 + contrast * 0.34, 0, 1);
}

export function sessionCoverage(candidates, bins = POSE_BINS) {
  const occupied = new Set((candidates ?? []).map((candidate) => poseBin(candidate.pose?.yaw ?? 0, bins)));
  const frontal = (candidates ?? []).some((candidate) => Math.abs(candidate.pose?.yaw ?? 1) <= 0.2);
  return { occupied: occupied.size, total: bins.length, ratio: occupied.size / bins.length, frontal };
}
