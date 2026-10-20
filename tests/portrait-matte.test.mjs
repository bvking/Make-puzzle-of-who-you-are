import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortraitMatte, compositePortraitOnWhite, PORTRAIT_HEAD_CLASSES} from '../Taquin deux visages interpolés/portrait-matte.mjs';

const width = 80, height = 100;
const faceOval = Array.from({length:36}, (_, i) => ({x:40 + 18 * Math.cos(i * Math.PI / 18), y:48 + 26 * Math.sin(i * Math.PI / 18)}));
const base = {width, height, faceOval};
const index = (x, y) => y * width + x;
const category = () => {
  const data = new Uint8Array(width * height);
  for (let y = 18; y < 76; y++) for (let x = 20; x < 61; x++) data[index(x, y)] = y < 29 ? 1 : 3;
  return data;
};
const pixel = (rgba, x, y) => Array.from(rgba.slice(index(x, y) * 4, index(x, y) * 4 + 4));

function portrait() {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) rgba.set([20, 70, 130, 255], i * 4);
  return rgba;
}

test('the head class mapping excludes body skin and clothing', () => {
  assert.deepEqual(PORTRAIT_HEAD_CLASSES, [1, 3, 5]);
  const data = category();
  for (let y = 76; y < height; y++) for (let x = 0; x < width; x++) data[index(x, y)] = y < 84 ? 2 : 4;
  const matte = createPortraitMatte({...base, categoryMask:data});
  assert.equal(matte.method, 'head-segmentation');
  assert.equal(matte.warning, '');
  assert.equal(matte.alpha[index(40, 90)], 0);
  assert.equal(matte.alpha[index(40, 80)], 0);
  assert.equal(matte.alpha[index(40, 21)], 255, 'connected hair is kept');
});

test('eyes, teeth, mouth and glasses remain opaque despite holes or wrong labels inside the face', () => {
  const data = category();
  for (const [x, y] of [[32, 40], [48, 40], [40, 61], [40, 56]]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) data[index(x + dx, y + dy)] = 0;
  }
  const matte = createPortraitMatte({...base, categoryMask:data});
  for (const [x, y] of [[32, 40], [48, 40], [40, 61], [40, 56]]) assert.equal(matte.alpha[index(x, y)], 255);
});

test('anatomical bound rejects background connected to the head and broad neck or shoulders', () => {
  const data = category();
  // False accessory detection touches the head but spreads to image edges.
  for (let y = 30; y < 36; y++) for (let x = 0; x < width; x++) data[index(x, y)] = 5;
  // Deliberately mislabeled shirt is still clipped by the lower head cap.
  for (let y = 74; y < height; y++) for (let x = 20; x < 60; x++) data[index(x, y)] = 3;
  const matte = createPortraitMatte({...base, categoryMask:data});
  assert.equal(matte.alpha[index(0, 32)], 0);
  assert.equal(matte.alpha[index(79, 32)], 0);
  assert.equal(matte.alpha[index(40, 85)], 0);
});

test('detached segmentation specks within the head cap are removed', () => {
  const data = category();
  data[index(40, 5)] = 1;
  const matte = createPortraitMatte({...base, categoryMask:data});
  assert.equal(matte.alpha[index(40, 5)], 0);
  assert.equal(matte.alpha[index(40, 21)], 255);
});

test('low-resolution confidence channels are resampled and summed before thresholding', () => {
  const maskWidth = 20, maskHeight = 25;
  const confidenceMasks = Array.from({length:6}, () => new Float32Array(maskWidth * maskHeight));
  for (let y = 4; y < 19; y++) for (let x = 5; x < 15; x++) {
    confidenceMasks[1][y * maskWidth + x] = .25;
    confidenceMasks[3][y * maskWidth + x] = .35;
  }
  const matte = createPortraitMatte({...base, confidenceMasks, maskWidth, maskHeight});
  assert.equal(matte.method, 'head-segmentation');
  assert.equal(matte.alpha[index(40, 21)], 255);
  assert.equal(matte.alpha[index(1, 1)], 0);
});

test('a missing, invalid or uninformative mask uses a curved face fallback with an explicit warning', () => {
  for (const extra of [{}, {categoryMask:new Uint8Array(2)}, {categoryMask:new Uint8Array(width * height)}, {headConfidence:new Float32Array(width * height).fill(1)}, {headConfidence:new Float32Array(width * height).fill(NaN)}]) {
    const matte = createPortraitMatte({...base, ...extra});
    assert.equal(matte.method, 'face-oval-fallback');
    assert.match(matte.warning, /Détourage approximatif/);
    assert.equal(matte.alpha[index(40, 48)], 255);
    assert.equal(matte.alpha[index(22, 22)], 0, 'oval bounding box corner stays outside');
    assert.equal(matte.alpha[index(40, 16)], 0, 'fallback does not invent a hair outline');
  }
});

test('feather is restricted to one to three inner pixels and never grows into background', () => {
  const rect = [{x:10,y:10},{x:70,y:10},{x:70,y:90},{x:10,y:90}];
  for (const requested of [-10, 1, 2, 3, 20]) {
    const matte = createPortraitMatte({...base, faceOval:rect, featherPx:requested});
    assert.ok(matte.featherPx >= 1 && matte.featherPx <= 3);
    assert.equal(matte.alpha[index(9, 50)], 0);
    assert.ok(matte.alpha[index(10, 50)] > 0 && matte.alpha[index(10, 50)] < 255);
    assert.equal(matte.alpha[index(13, 50)], 255);
  }
});

test('white composition preserves solid foreground exactly and makes all background opaque white', () => {
  const input = portrait(), original = input.slice();
  const matte = createPortraitMatte({...base, categoryMask:category()});
  const output = compositePortraitOnWhite(input, matte);
  assert.deepEqual(pixel(output, 40, 48), pixel(input, 40, 48));
  assert.deepEqual(pixel(output, 0, 0), [255,255,255,255]);
  assert.deepEqual(input, original);
  for (let i = 0; i < matte.alpha.length; i++) {
    assert.equal(output[i * 4 + 3], 255);
    if (!matte.alpha[i]) assert.deepEqual(Array.from(output.slice(i * 4, i * 4 + 4)), [255,255,255,255]);
  }
});

test('transparent source pixels are composited against white rather than exposing black', () => {
  const input = portrait(), matte = createPortraitMatte(base);
  input.set([0,0,0,0], index(40,48) * 4);
  input.set([0,0,0,128], index(40,50) * 4);
  const output = compositePortraitOnWhite(input, matte);
  assert.deepEqual(pixel(output,40,48), [255,255,255,255]);
  assert.deepEqual(pixel(output,40,50), [127,127,127,255]);
});

test('equivalent white backgrounds stay white throughout interpolation, with different face sizes', () => {
  const first = compositePortraitOnWhite(portrait(), createPortraitMatte(base));
  const smaller = faceOval.map(p => ({x:40 + (p.x - 40) * .7, y:48 + (p.y - 48) * .7}));
  const second = compositePortraitOnWhite(portrait(), createPortraitMatte({...base, faceOval:smaller}));
  for (const t of [0, .25, .5, .75, 1]) for (const [x,y] of [[0,0],[79,0],[0,99],[79,99],[5,50],[40,95]]) {
    const j = index(x,y) * 4;
    for (let channel = 0; channel < 4; channel++) assert.equal(first[j+channel] * (1-t) + second[j+channel] * t, 255);
  }
});

test('invalid dimensions and geometry cannot silently produce a previous or blank matte', () => {
  for (const extra of [{width:0},{height:NaN},{width:2.5},{faceOval:[]},{faceOval:[{x:1,y:1},{x:2,y:2},{x:3,y:3}]},{faceOval:[{x:NaN,y:0},{x:2,y:3},{x:4,y:1}]}]) {
    assert.throws(() => createPortraitMatte({...base,...extra}));
  }
  assert.throws(() => compositePortraitOnWhite(new Uint8Array(2), createPortraitMatte(base)), /matching dimensions/);
  assert.throws(() => createPortraitMatte({...base, categoryMask:category(), downAxis:{x:0,y:0}}), /down axis/);
});

test('the anatomical cap follows the head orientation instead of retaining a vertical neck', () => {
  const rotatedOval = faceOval.map(p => ({x:40 + (p.y - 48), y:48 - (p.x - 40)}));
  const confidence = new Float32Array(width * height);
  for (let y = 28; y < 69; y++) for (let x = 1; x < 79; x++) confidence[index(x,y)] = 1;
  const matte = createPortraitMatte({...base, faceOval:rotatedOval, downAxis:{x:1,y:0}, headConfidence:confidence});
  assert.equal(matte.method, 'head-segmentation');
  assert.equal(matte.alpha[index(5,48)], 255, 'hair above the rotated forehead remains');
  assert.equal(matte.alpha[index(73,48)], 0, 'below the rotated chin is background');
});

test('building separate mattes never mutates source geometry or model arrays', () => {
  const data = category(), copy = data.slice(), ovalCopy = structuredClone(faceOval);
  const first = createPortraitMatte({...base, categoryMask:data});
  const next = createPortraitMatte({...base, categoryMask:data});
  assert.deepEqual(data, copy);
  assert.deepEqual(faceOval, ovalCopy);
  assert.deepEqual(first.alpha, next.alpha);
  assert.notEqual(first.alpha, next.alpha);
});
