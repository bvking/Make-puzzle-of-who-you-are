import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('const MORPH_LINEAR='),page.indexOf('function renderCanvasMorph('));
const {blendMorphPixels,morphTopologyMatches}=new Function(source+';return {blendMorphPixels,morphTopologyMatches}')();
function blend(a,b,t){return [...blendMorphPixels(a,b,t,new Uint8ClampedArray(a.length))]}
test('Canvas midpoint preserves linear-light brightness',()=>{
 assert.deepEqual(blend([0,0,0,255],[255,255,255,255],.5),[188,188,188,255]);
});
test('all opaque channel values survive both endpoints',()=>{
 for(let value=0;value<256;value++){
  const pixel=[value,255-value,value,255];
  assert.deepEqual(blend(pixel,[0,0,0,255],0),pixel);
  assert.deepEqual(blend([0,0,0,255],pixel,1),pixel);
 }
});
test('transparent mesh edges do not leak hidden colors',()=>{
 assert.deepEqual(blend([255,0,0,0],[0,0,255,255],.5),[0,0,255,128]);
 assert.deepEqual(blend([255,0,0,0],[0,0,255,0],.5),[0,0,0,0]);
});
test('in-place blend equals separate output and is symmetric',()=>{
 const a=new Uint8ClampedArray([70,123,211,127,255,0,60,255]),b=new Uint8ClampedArray([190,45,90,255,12,220,78,60]);
 const expected=blend(a,b,.35);
 assert.deepEqual(blend(b,a,.65),expected);
 blendMorphPixels(a,b,.35,a);
 assert.deepEqual([...a],expected);
});
test('WebGL notices changed connectivity even with the same triangle count',()=>{
 const indices=new Uint16Array([0,1,2,0,2,3]);
 assert.equal(morphTopologyMatches(indices,[[0,1,2],[0,2,3]]),true);
 assert.equal(morphTopologyMatches(indices,[[0,1,3],[1,2,3]]),false);
 assert.equal(morphTopologyMatches(indices,[[0,1,2]]),false);
 assert.equal(morphTopologyMatches(null,[[0,1,2]]),false);
});
