import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePhotometry,
  automaticHarmony,
  captureQuality,
  chooseMatchedPair,
  commonYawRange,
  derivePose,
  laplacianVariance,
  pairCost,
  poseBin,
  retainBestByPose,
  sessionCoverage,
} from '../Taquin deux visages interpolés/multiview-core.mjs';
import landmarksFixture from '../Taquin deux visages interpolés/qa/portrait-landmarks.json' with { type: 'json' };

const base = landmarksFixture['visage_homme.png'];
const secondDemoFace = landmarksFixture['visage_femme.png'];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function assertClose(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || 'values differ'}: expected ${expected}, received ${actual}`,
  );
}

function solidPixels(value, count = 128) {
  const pixels = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index++) pixels.set([value, value, value, 255], index * 4);
  return pixels;
}

function variedCandidate(id, random) {
  const entry = candidate(id, random() * 1.6 - 0.8, 45 + random() * 55, 0.08 + random() * 0.84);
  entry.pose.pitch = random() * 0.8 - 0.4;
  entry.pose.roll = random() * Math.PI * 2 - Math.PI;
  entry.pose.scale = 0.1 + random() * 0.35;
  entry.pose.mouthOpen = random() * 0.45;
  entry.pose.mouthCurve = random() * 0.3 - 0.15;
  entry.pose.eyeOpen = [random() * 0.35, random() * 0.35];
  entry.photometry.contrast = 0.08 + random() * 0.65;
  return entry;
}

function transform(points, { scale = 1, rotation = 0, tx = 0, ty = 0 } = {}) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return points.map((point) => ({
    ...point,
    x: scale * (cosine * (point.x - 0.5) - sine * (point.y - 0.5)) + 0.5 + tx,
    y: scale * (sine * (point.x - 0.5) + cosine * (point.y - 0.5)) + 0.5 + ty,
  }));
}

function candidate(id, yaw, quality = 80, median = 0.5) {
  return {
    id,
    pose: { yaw, pitch: 0, roll: 0, scale: 0.22, mouthOpen: 0.08, mouthCurve: 0, eyeOpen: [0.2, 0.2] },
    quality: { score: quality },
    photometry: { usable: true, median, contrast: 0.4, darkClip: 0, lightClip: 0 },
  };
}

test('pose is invariant to global translation and scale', () => {
  const original = derivePose(base, FACE_OVAL);
  const changed = derivePose(transform(base, { scale: 0.72, tx: 0.08, ty: -0.05 }), FACE_OVAL);
  assert.ok(original && changed);
  assert.ok(Math.abs(original.yaw - changed.yaw) < 1e-6);
  assert.ok(Math.abs(original.pitch - changed.pitch) < 1e-6);
  assert.ok(Math.abs(changed.scale / original.scale - 0.72) < 1e-6);
});

test('bundled two-person demo remains matchable despite a different mouth expression', () => {
  const firstPose = derivePose(base, FACE_OVAL);
  const secondPose = derivePose(secondDemoFace, FACE_OVAL);
  assert.ok(firstPose && secondPose);
  assert.ok(Math.abs(firstPose.yaw - secondPose.yaw) < 0.34, 'demo viewpoints must remain matchable');
  assert.ok(Math.abs(firstPose.mouthOpen - secondPose.mouthOpen) > 0.12, 'demo mouth expressions must remain different');

  const first = {
    ...candidate('demo-a', firstPose.yaw, 90, 0.48),
    pose: firstPose,
    landmarks: base,
  };
  const second = {
    ...candidate('demo-b', secondPose.yaw, 90, 0.5),
    pose: secondPose,
    landmarks: secondDemoFace,
  };
  const pair = chooseMatchedPair([first], [second], {
    maxPoseGap: 0.34,
    preserveExpressionDifference: true,
  });
  assert.ok(pair);
  assert.equal(pair.first.id, 'demo-a');
  assert.equal(pair.second.id, 'demo-b');
});

test('seeded random scale and translation preserve normalized pose', () => {
  const random = seededRandom(0x15a11ce);
  const original = derivePose(base, FACE_OVAL);
  assert.ok(original);

  for (let iteration = 0; iteration < 96; iteration++) {
    const scale = 0.42 + random() * 1.24;
    const tx = random() * 0.7 - 0.35;
    const ty = random() * 0.7 - 0.35;
    const changed = derivePose(transform(base, { scale, tx, ty }), FACE_OVAL);
    assert.ok(changed, `pose missing at iteration ${iteration}`);
    assertClose(changed.yaw, original.yaw, 1e-6, `yaw at iteration ${iteration}`);
    assertClose(changed.pitch, original.pitch, 1e-6, `pitch at iteration ${iteration}`);
    assertClose(changed.roll, original.roll, 1e-6, `roll at iteration ${iteration}`);
    assertClose(changed.scale / original.scale, scale, 1e-6, `scale at iteration ${iteration}`);
  }
});

test('roll follows the camera rotation without corrupting yaw', () => {
  const original = derivePose(base);
  const changed = derivePose(transform(base, { rotation: 0.21 }));
  assert.ok(Math.abs(changed.roll - original.roll - 0.21) < 1e-5);
  assert.ok(Math.abs(original.yaw - changed.yaw) < 1e-6);
});

test('photometry detects exposure and clipping', () => {
  const pixels = new Uint8ClampedArray(400 * 4);
  for (let index = 0; index < 400; index++) {
    const value = index < 40 ? 0 : index > 360 ? 255 : 96 + (index % 80);
    pixels.set([value, value, value, 255], index * 4);
  }
  const metrics = analyzePhotometry(pixels);
  assert.ok(metrics.usable);
  assert.ok(metrics.darkClip > 0.09);
  assert.ok(metrics.lightClip > 0.09);
  assert.ok(metrics.contrast > 0.2);
});

test('photometry and quality reject black, white, and bimodally clipped captures', () => {
  const dark = analyzePhotometry(solidPixels(0));
  const bright = analyzePhotometry(solidPixels(255));
  const bimodalPixels = new Uint8ClampedArray(128 * 4);
  for (let index = 0; index < 128; index++) {
    const value = index < 64 ? 0 : 255;
    bimodalPixels.set([value, value, value, 255], index * 4);
  }
  const bimodal = analyzePhotometry(bimodalPixels);

  assert.deepEqual(
    { median: dark.median, darkClip: dark.darkClip, lightClip: dark.lightClip, contrast: dark.contrast, usable: dark.usable },
    { median: 0, darkClip: 1, lightClip: 0, contrast: 0, usable: true },
  );
  assertClose(bright.median, 1, 1e-12, 'white median');
  assert.deepEqual(
    { darkClip: bright.darkClip, lightClip: bright.lightClip, contrast: bright.contrast, usable: bright.usable },
    { darkClip: 0, lightClip: 1, contrast: 0, usable: true },
  );
  assertClose(bimodal.median, 0.5, 1e-12, 'bimodal median');
  assert.equal(bimodal.darkClip, 0.5);
  assert.equal(bimodal.lightClip, 0.5);
  assertClose(bimodal.contrast, 1, 1e-12, 'bimodal contrast');

  const usablePose = { inFrame: 1, width: 0.55, height: 0.72, scale: 0.22 };
  const darkQuality = captureQuality({ pose: usablePose, photometry: dark, sharpness: 0.001 });
  const brightQuality = captureQuality({ pose: usablePose, photometry: bright, sharpness: 0.001 });
  const bimodalQuality = captureQuality({ pose: usablePose, photometry: bimodal, sharpness: 0.001 });
  assert.equal(darkQuality.ok, false);
  assert.ok(darkQuality.reasons.includes('visage trop sombre'));
  assert.ok(darkQuality.reasons.includes('ombres bouchées'));
  assert.equal(brightQuality.ok, false);
  assert.ok(brightQuality.reasons.includes('visage surexposé'));
  assert.ok(brightQuality.reasons.includes('hautes lumières brûlées'));
  assert.equal(bimodalQuality.ok, false);
  assert.ok(bimodalQuality.reasons.includes('ombres bouchées'));
  assert.ok(bimodalQuality.reasons.includes('hautes lumières brûlées'));
  assert.equal(automaticHarmony({ ...bimodal }, { ...bimodal, median: 0.2 }), 0);
});

test('laplacian variance distinguishes a flat image from edges', () => {
  const flat = new Float32Array(100).fill(0.5);
  const checker = new Float32Array(100).map((_, index) => ((index + Math.floor(index / 10)) % 2 ? 1 : 0));
  assert.equal(laplacianVariance(flat, 10, 10), 0);
  assert.ok(laplacianVariance(checker, 10, 10) > 1);
});

test('matched pair prefers the same viewpoint despite scale and light changes', () => {
  const first = [candidate('a-left', -0.55, 88, 0.25), candidate('a-front', 0.02, 82, 0.75)];
  const second = [candidate('b-left', -0.5, 78, 0.82), candidate('b-front', 0.24, 95, 0.2)];
  const pair = chooseMatchedPair(first, second, { targetYaw: -0.5 });
  assert.equal(pair.first.id, 'a-left');
  assert.equal(pair.second.id, 'b-left');
  assert.ok(pair.poseGap < 0.1);
});

test('matched pair can reject sessions without a common viewpoint', () => {
  const first = [candidate('a-left', -0.8, 90)];
  const second = [candidate('b-right', 0.8, 90)];
  assert.ok(chooseMatchedPair(first, second));
  assert.equal(chooseMatchedPair(first, second, { maxPoseGap: 0.34 }), null);
});

test('retention keeps the best candidates in each pose bin', () => {
  let candidates = [];
  candidates = retainBestByPose(candidates, candidate('weak', 0.02, 42), { perBin: 1 });
  candidates = retainBestByPose(candidates, candidate('strong', 0.04, 91), { perBin: 1 });
  candidates = retainBestByPose(candidates, candidate('left', -0.5, 70), { perBin: 1 });
  assert.deepEqual(candidates.map((entry) => entry.id), ['left', 'strong']);
  assert.equal(poseBin(-0.5), candidates[0].poseBin);
});

test('retention result is independent of seeded insertion order', () => {
  const source = [
    candidate('front-low', 0.01, 41),
    candidate('front-high', 0.03, 96),
    candidate('front-mid', -0.02, 73),
    candidate('left-high', -0.49, 93),
    candidate('left-mid', -0.46, 76),
    candidate('left-low', -0.51, 35),
    candidate('right-high', 0.5, 89),
    candidate('right-mid', 0.46, 67),
    candidate('far-right', 0.71, 82),
  ];
  const retainAll = (entries) => entries.reduce(
    (kept, entry) => retainBestByPose(kept, entry, { perBin: 2 }),
    [],
  );
  const expected = retainAll(source).map((entry) => `${entry.poseBin}:${entry.id}:${entry.quality.score}`);
  assert.deepEqual(expected, [
    '1:left-high:93',
    '1:left-mid:76',
    '3:front-high:96',
    '3:front-mid:73',
    '5:right-high:89',
    '5:right-mid:67',
    '6:far-right:82',
  ]);

  const random = seededRandom(0x0ddc0ffe);
  for (let iteration = 0; iteration < 32; iteration++) {
    const actual = retainAll(shuffled(source, random)).map(
      (entry) => `${entry.poseBin}:${entry.id}:${entry.quality.score}`,
    );
    assert.deepEqual(actual, expected, `selection changed at shuffle ${iteration}`);
  }
});

test('pair cost and selected pair are symmetric and order independent', () => {
  const random = seededRandom(0x5e771e);
  for (let iteration = 0; iteration < 64; iteration++) {
    const first = variedCandidate(`random-a-${iteration}`, random);
    const second = variedCandidate(`random-b-${iteration}`, random);
    const options = {
      targetYaw: iteration % 3 ? random() * 1.2 - 0.6 : null,
      preserveExpressionDifference: iteration % 2 === 0,
    };
    assertClose(
      pairCost(first, second, options),
      pairCost(second, first, options),
      1e-12,
      `pair cost at iteration ${iteration}`,
    );
  }

  const firstSession = [
    candidate('a-left', -0.46, 91, 0.32),
    candidate('a-front', 0.01, 76, 0.48),
    candidate('a-right', 0.5, 84, 0.7),
  ];
  const secondSession = [
    candidate('b-left', -0.43, 88, 0.68),
    candidate('b-front', -0.02, 72, 0.51),
    candidate('b-right', 0.47, 86, 0.29),
  ];
  const options = { targetYaw: -0.44 };
  const forward = chooseMatchedPair(firstSession, secondSession, options);
  const reverse = chooseMatchedPair(secondSession, firstSession, options);
  assert.ok(forward && reverse);
  assert.equal(forward.first.id, 'a-left');
  assert.equal(forward.second.id, 'b-left');
  assert.equal(reverse.first.id, 'b-left');
  assert.equal(reverse.second.id, 'a-left');
  assertClose(forward.cost, reverse.cost, 1e-12, 'reversed pair cost');
  assertClose(forward.poseGap, reverse.poseGap, 1e-12, 'reversed pose gap');
  assertClose(forward.confidence, reverse.confidence, 1e-12, 'reversed confidence');

  const shuffledForward = chooseMatchedPair(
    shuffled(firstSession, random),
    shuffled(secondSession, random),
    options,
  );
  assert.equal(shuffledForward.first.id, forward.first.id);
  assert.equal(shuffledForward.second.id, forward.second.id);
  assertClose(shuffledForward.cost, forward.cost, 1e-12, 'shuffled pair cost');
  assert.deepEqual(commonYawRange(firstSession, secondSession), commonYawRange(secondSession, firstSession));
});

test('blendshapes refine expression matching unless differences are preserved', () => {
  const first = candidate('a', 0, 80, 0.5);
  const second = candidate('b', 0, 80, 0.5);
  first.blendshapes = [{ name: 'jawOpen', score: 0.05 }, { name: 'eyeBlinkLeft', score: 0.02 }];
  second.blendshapes = [{ name: 'jawOpen', score: 0.9 }, { name: 'eyeBlinkLeft', score: 0.8 }];
  const matchedExpression = pairCost(first, second, { preserveExpressionDifference: false });
  const preservedExpression = pairCost(first, second, { preserveExpressionDifference: true });
  assert.ok(matchedExpression > preservedExpression);
});

test('coverage and common yaw range are deterministic', () => {
  const first = [candidate('a', -0.5), candidate('b', 0), candidate('c', 0.5)];
  const second = [candidate('d', -0.25), candidate('e', 0.2)];
  const coverage = sessionCoverage(first);
  assert.equal(coverage.occupied, 3);
  assert.equal(coverage.frontal, true);
  assert.deepEqual(commonYawRange(first, second), { minimum: -0.25, maximum: 0.2 });
});

test('automatic harmony remains off for similar captures and rises for different exposure', () => {
  const neutral = { usable: true, median: 0.5, contrast: 0.42, darkClip: 0, lightClip: 0 };
  assert.equal(automaticHarmony(neutral, { ...neutral, median: 0.51 }), 0);
  assert.ok(automaticHarmony(neutral, { ...neutral, median: 0.22, contrast: 0.24 }) > 0.7);
  assert.equal(automaticHarmony(neutral, { ...neutral, median: 0.1, darkClip: 0.5 }), 0);
});
