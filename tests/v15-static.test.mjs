import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('../Taquin deux visages interpolés/v15-multiview.html', import.meta.url);
const alphaPath = new URL('../Taquin deux visages interpolés/V15_alpha.html', import.meta.url);
const page = await readFile(pagePath, 'utf8');
const alphaBytes = await readFile(alphaPath);
const alphaPage = alphaBytes.toString('utf8');

function moduleSource(html) {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match, 'the v15 module script must exist');
  return match[1];
}

test('v15 inline module has valid JavaScript syntax', () => {
  const source = moduleSource(page).replace(/^import\s+.*?;\s*$/gm, '');
  assert.doesNotThrow(() => new Function(source));
});

test('V15_alpha is the byte-exact v15 from commit 77e715e', () => {
  assert.equal(
    createHash('sha256').update(alphaBytes).digest('hex'),
    '6c37a36791e0a55f36f04fc2f544747f12ad51d5d1531065e05eb9da82a65086',
  );
  const source = moduleSource(alphaPage).replace(/^import\s+.*?;\s*$/m, '');
  assert.doesNotThrow(() => new Function(source));
  assert.match(alphaPage, /const desiredMode=\['canvas','webgl','regions'\]\.includes\(previousMode\)\?previousMode:'canvas'/);
});

test('v15 contains unique element identifiers and all static lookups resolve', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
  const available = new Set(ids);
  const lookups = [...moduleSource(page).matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
  for (const id of lookups) assert.ok(available.has(id), `missing element #${id}`);
});

test('v15 exposes multiview, import, fallback and viewpoint controls', () => {
  for (const id of ['capture', 'stopScan', 'quickPhoto', 'nativePhoto', 'importPhotos', 'scanCoverage', 'viewpoint', 'applyViewpoint']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /detectForVideo\(/);
  assert.match(page, /retainBestByPose\(/);
  assert.match(page, /chooseMatchedPair\(/);
});

test('v15 states the requested goal and the unresolved perspective limitation', () => {
  assert.match(page, /Objectif demandé — pas encore atteint pour des perspectives différentes/);
  assert.match(page, /même visage ou de deux visages différents/);
  assert.match(page, /ne reconstruit pas un visage sous un nouvel angle/);
  assert.match(page, /au moins une perspective suffisamment proche/);
  assert.match(page, /reproduction CPU du pipeline géométrique/);
  assert.match(page, /ne valide pas le pilote WebGL de l’iPhone/);
});

test('v15 defaults to complete identity morph while preserving local and legacy modes', () => {
  assert.match(page, /const desiredMode=wasAlign&&\['full','canvas','webgl','regions','stabilized','local'\]\.includes\(previousMode\)\?previousMode:'full'/);
  assert.match(page, /data-mode="full"/);
  assert.match(page, /data-mode="local"/);
  assert.match(page, /function renderLocalExpressions\(/);
  assert.match(page, /localMaskFeatures\(points,protectGlasses,referencePoints,alignedPoints\)/);
  assert.match(page, /data-mode="stabilized"/);
  assert.match(page, /function renderStabilizedFace\(/);
  assert.match(page, /const key=state\.photoVersion\+'\|'\+state\.morphTopologyVersion/);
  assert.match(page, /geometry=localized\?stabilizedGeometry\(v\)/);
  assert.match(page, /const MANUAL_ALIGNMENT_IDS=\['offsetX','offsetY','scale','rotation'\]/);
  assert.match(page, /MANUAL_ALIGNMENT_IDS\.includes\(id\)&&state\.mode!=='regions'/);
  assert.match(page, /manual affine refinement is therefore intentionally reserved to Régions/);
  assert.match(page, /L’interpolation globale y est intégrée au maillage/);
  assert.match(page, /Horizontal, Vertical, Zoom fin et Rotation fin sont réservés à Régions/);
});

test('v15 keeps dependencies reproducible and camera mirroring conditional', () => {
  assert.doesNotMatch(page, /\/latest\//);
  assert.doesNotMatch(page, /user-scalable=no/);
  assert.match(page, /video\.classList\.toggle\('is-mirrored',state\.activeFacing==='user'\)/);
  const captureFunction = page.match(/function captureSquare\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(captureFunction, /scale\(-1,1\)/);
  assert.match(page, /confidenceMasks\?\.\[1\]/);
});

test('v15 keeps slow iPhone camera permission requests alive and offers native capture', () => {
  assert.match(page, /<video id="video" autoplay playsinline muted>/);
  assert.match(page, /id="nativePhoto"[^>]+capture="user"/);
  assert.doesNotMatch(page, /Promise\.race\(\[cameraPromise/);
  assert.match(page, /Autorisation toujours en attente/);
  assert.match(page, /Annuler l’attente/);
  assert.match(page, /contains\('active'\)\)\{if\(state\.stream\)stopCamera\(\);else updateScanUI\(\)\}/);
  assert.match(page, /append:true,finalize:false/);
  assert.match(page, /\['importPhotos','nativePhoto'\].*cameraPending\|\|state\.stream/);
});

test('v15 explosive regions stay attached to the face', () => {
  assert.match(page, /explosivePulse\(/);
  assert.match(page, /sans détacher de fragments du visage/);
  assert.doesNotMatch(page, /advanced-region-effect-layer/);
  assert.doesNotMatch(page, /advanced-region-effect-composition/);
  assert.doesNotMatch(page, /applyRegionAnimationEffect\(/);
  assert.doesNotMatch(page, /renderStyle/);
});

test('v15 diagnostic generates actual 25, 50, and 75 percent renderer snapshots', () => {
  assert.match(page, /id="diagnosticOpen"[^>]*>Ouvrir le diagnostic 25 \/ 50 \/ 75 %<\/button>/);
  assert.match(page, /\$\('diagnosticOpen'\)\.addEventListener\('click'/);
  assert.match(page, /section\.open=true/);
  assert.match(page, /section\.scrollIntoView/);
  for (const id of ['morphDiagnostic', 'diagnosticPosition', 'diagnosticCapture', 'diagnosticStatus', 'diagnosticWarpA', 'diagnosticWarpB', 'diagnosticMixed', 'diagnostic25', 'diagnostic50', 'diagnostic75']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  for (const percent of [0, 25, 50, 75, 100]) assert.match(page, new RegExp(`<option value="${percent}"`));
  assert.match(page, /function captureMorphDiagnostic\(/);
  assert.match(page, /state\.animation\.userFrozen=true/);
  assert.match(page, /for\(const position of \[25,50,75\]\)/);
  assert.match(page, /diagnosticMorphValue\(controls,position\)/);
  assert.match(page, /renderSelected\(alignCanvas,\{updateUI:false,values:v,mode:state\.mode\}\)/);
  assert.match(page, /geometry\.raw1,geometry\.target,geometry\.triangles/);
  assert.match(page, /geometry\.raw2,geometry\.target,geometry\.triangles/);
  assert.match(page, /renderSelected\(alignCanvas,\{values:v,mode:state\.mode\}\)/);
  assert.match(page, /info\?\.renderer==='webgl'/);
  assert.match(page, /renderer:'canvas'/);
  assert.match(page, /renderer:'webgl'/);
  assert.match(page, /uniform1f\(r\.locations\.mix,geometry\.textureMix\?\?geometry\.t\)/);
  assert.match(page, /blendMorphPixels\(pixelsA\.data,pixelsB\.data,geometry\.textureMix\?\?geometry\.t,pixelsA\.data\)/);
});

test('v15 does not confuse MediaPipe import errors with no face detected', () => {
  assert.match(page, /Erreur technique MediaPipe lors de l’analyse de la photo/);
  assert.doesNotMatch(page, /closeImageLandmarker\(\);return null/);
});
