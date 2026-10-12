import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localMaskFeatures} from '../Taquin deux visages interpolés/local-expression.mjs';

const PAGE=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
function face(){
 const p=Array.from({length:478},()=>({x:375,y:400}));
 const features={33:[230,280],133:[310,285],362:[440,285],263:[520,280],
  61:[290,515],291:[465,515],13:[377,500],14:[377,550],1:[377,400],152:[377,640]};
 for(const [id,[x,y]] of Object.entries(features))p[Number(id)]={x,y};
 return p;
}

test('local expression weights preserve glasses by omitting eyes when protection enabled',()=>{
 const points=face(),fields=localMaskFeatures(points,true);
 assert.deepEqual(fields.map(f=>f.name),['mouth','nose']);
 assert.equal(fields[0].opacity,.98);
 assert.ok(fields[1].opacity<.3);
 assert.ok(fields.every(f=>f.rx>0&&f.ry>0&&f.opacity>=0&&f.opacity<=1));
});

test('unprotected mode can morph eyes while retaining mouth priority',()=>{
 const p=face();
 const protectedFields=localMaskFeatures(p,true),unprotected=localMaskFeatures(p,false);
 assert.deepEqual(unprotected.map(f=>f.name),['mouth','nose','leftEye','rightEye']);
 assert.equal(unprotected[0].opacity,protectedFields[0].opacity);
 assert.ok(unprotected[2].opacity<unprotected[0].opacity);
 assert.ok(unprotected[3].opacity<unprotected[0].opacity);
});

test('missing landmarks are rejected and source landmarks are never modified',()=>{
 const landmarks=face(),before=JSON.stringify(landmarks);
 assert.ok(localMaskFeatures(landmarks));
 assert.equal(JSON.stringify(landmarks),before);
 landmarks[61]=null;
 assert.equal(localMaskFeatures(landmarks),null);
 assert.equal(localMaskFeatures(null),null);
});

test('local renderer composites warped expression layer on unmodified photo A',()=>{
 assert.match(PAGE,/data-mode="local"/);
 assert.match(PAGE,/function renderLocalExpressions\(canvas,v\)/);
 assert.match(PAGE,/const geometry=stabilizedGeometry\(v\),ctx=drawBackground\(canvas\)/);
 assert.match(PAGE,/localExpressionMask\(canvas\.width,geometry\.target,protect\)/);
 assert.match(PAGE,/mctx\.globalCompositeOperation='destination-in';mctx\.drawImage\(mask,0,0\)/);
 assert.match(PAGE,/ctx\.drawImage\(masked,0,0\)/);
 assert.match(PAGE,/id="localProtectGlasses" type="checkbox" checked/);
 assert.match(PAGE,/#localExpressionOptions\[hidden\]\{display:none\}/);
 assert.match(PAGE,/if\(mode==='local'\)info=renderLocalExpressions\(canvas,v\)/);
 assert.match(PAGE,/const localized=\['stabilized','local'\]\.includes\(state\.mode\)/);
 assert.match(PAGE,/state\.mode==='webgl'&&engine!=='webgl'/);
});

test('local mode animation samples requested transition rather than Regions effects',()=>{
 assert.match(PAGE,/state\.mode==='webgl'\|\|state\.mode==='stabilized'\|\|state\.mode==='local'\)return animationSnapshot\(state\.mode/);
 assert.match(PAGE,/\['stabilized','local'\]\.includes\(state\.mode\)&&!!stabilizedGeometry/);
 assert.match(PAGE,/state\.mode==='local'\?\x60Animation expressions locales active/);
});
