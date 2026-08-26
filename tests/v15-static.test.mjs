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
  const source = moduleSource(page).replace(/^import\s+.*?;\s*$/m, '');
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

test('v15 prefers WebGL after the first validated pair and keeps full-frame alignment automatic', () => {
  assert.match(page, /const desiredMode=wasAlign&&\['canvas','webgl','regions'\]\.includes\(previousMode\)\?previousMode:'webgl'/);
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
