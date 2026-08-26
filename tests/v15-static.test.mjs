import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('../Taquin deux visages interpolés/v15-multiview.html', import.meta.url);
const page = await readFile(pagePath, 'utf8');

function moduleSource(html) {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match, 'the v15 module script must exist');
  return match[1];
}

test('v15 inline module has valid JavaScript syntax', () => {
  const source = moduleSource(page).replace(/^import\s+.*?;\s*$/m, '');
  assert.doesNotThrow(() => new Function(source));
});

test('v15 contains unique element identifiers and all static lookups resolve', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
  const available = new Set(ids);
  const lookups = [...moduleSource(page).matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
  for (const id of lookups) assert.ok(available.has(id), `missing element #${id}`);
});

test('v15 exposes multiview, import, fallback and viewpoint controls', () => {
  for (const id of ['capture', 'stopScan', 'quickPhoto', 'importPhotos', 'scanCoverage', 'viewpoint', 'applyViewpoint']) {
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
});

test('v15 keeps dependencies reproducible and camera mirroring conditional', () => {
  assert.doesNotMatch(page, /\/latest\//);
  assert.doesNotMatch(page, /user-scalable=no/);
  assert.match(page, /video\.classList\.toggle\('is-mirrored',state\.activeFacing==='user'\)/);
  const captureFunction = page.match(/function captureSquare\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(captureFunction, /scale\(-1,1\)/);
  assert.match(page, /confidenceMasks\?\.\[1\]/);
});
