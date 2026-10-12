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
 assert.deepEqual(fields.map(f=>f.name),['mouth','lowerFace','nose']);
 assert.equal(fields[0].opacity,.98);
 assert.ok(fields[1].opacity<fields[0].opacity);
 assert.ok(fields[2].opacity<.3);
 assert.ok(fields.every(f=>f.rx>0&&f.ry>0&&f.opacity>=0&&f.opacity<=1));
});

test('unprotected mode can morph eyes while retaining mouth priority',()=>{
 const p=face();
 const protectedFields=localMaskFeatures(p,true),unprotected=localMaskFeatures(p,false);
 assert.deepEqual(unprotected.map(f=>f.name),['mouth','lowerFace','nose','leftEye','rightEye']);
 assert.equal(unprotected[0].opacity,protectedFields[0].opacity);
 assert.ok(unprotected[3].opacity<unprotected[0].opacity);
 assert.ok(unprotected[4].opacity<unprotected[0].opacity);
});

test('missing landmarks are rejected and source landmarks are never modified',()=>{
 const landmarks=face(),before=JSON.stringify(landmarks);
 assert.ok(localMaskFeatures(landmarks));
 assert.equal(JSON.stringify(landmarks),before);
 landmarks[61]=null;
 assert.equal(localMaskFeatures(landmarks),null);
 assert.equal(localMaskFeatures(null),null);
});


test('mask covers both A and aligned B mouth opening, not just the current frame',()=>{
 const a=face(),b=face(),mid=face();
 b[14]={...b[14],y:660}; b[152]={...b[152],y:705};
 mid[14]={...mid[14],y:570};
 const current=localMaskFeatures(mid,true);
 const union=localMaskFeatures(mid,true,a,b);
 assert.ok(union[0].ry>current[0].ry,'mouth mask must contain B even when current lips are only half open');
 assert.ok(union[1].ry>0&&union[1].opacity<union[0].opacity,'jaw moves softly with the expression');
 assert.deepEqual(a,face(),'source A must stay unchanged');
 assert.equal(b[14].y,660,'aligned B source must stay unchanged');
});

test('bad extra capture is ignored rather than invalidating a valid face',()=>{
 const p=face();
 assert.deepEqual(localMaskFeatures(p,true,p,null),localMaskFeatures(p,true,p,[]));
});

test('local renderer composites warped expression layer on unmodified photo A',()=>{
 assert.match(PAGE,/data-mode="local"/);
 assert.match(PAGE,/function renderLocalExpressions\(canvas,v\)/);
 assert.match(PAGE,/const geometry=stabilizedGeometry\(v\),ctx=drawBackground\(canvas\)/);
 assert.match(PAGE,/localExpressionMask\(canvas\.width,geometry\.target,protect,geometry\.raw1,geometry\.alignedSecond\)/);
 assert.match(PAGE,/mctx\.globalCompositeOperation='destination-in';mctx\.drawImage\(mask,0,0\)/);
 assert.match(PAGE,/ctx\.drawImage\(masked,0,0\)/);
 assert.match(PAGE,/id="localProtectGlasses" type="checkbox" checked/);
 assert.match(PAGE,/#localExpressionOptions\[hidden\],#diagnosticNeutralChoice\[hidden\]\{display:none\}/);
 assert.match(PAGE,/if\(mode==='local'\)info=renderLocalExpressions\(canvas,v\)/);
 assert.match(PAGE,/const localized=\['stabilized','local'\]\.includes\(state\.mode\)/);
 assert.match(PAGE,/state\.mode==='webgl'&&engine!=='webgl'/);
});

test('local mode animation samples requested transition rather than Regions effects',()=>{
 assert.match(PAGE,/state\.mode==='webgl'\|\|state\.mode==='stabilized'\|\|state\.mode==='local'\)return animationSnapshot\(state\.mode/);
 assert.match(PAGE,/\['stabilized','local'\]\.includes\(state\.mode\)&&!!stabilizedGeometry/);
 assert.match(PAGE,/state\.mode==='local'\?\x60Animation expressions locales active/);
});

test('single diagnostic click compares 25, 50, 75 in local and stabilized modes',()=>{
 assert.match(PAGE,/compareLegacy=state\.mode==='local'/);
 assert.match(PAGE,/\$\('diagnosticNeutralBlock'\)\.hidden=!\(withNeutral\|\|compareLegacy\)/);
 assert.match(PAGE,/for\(const position of \[25,50,75\]\)/);
 assert.match(PAGE,/const isolated=compareLegacy\?renderSelected\(alignCanvas,\{updateUI:false,values:v,mode:'stabilized'\}\)/);
 assert.match(PAGE,/copy\('diagnosticNeutral'\+position,alignCanvas\)/);
 for(const id of ['diagnosticNeutral25','diagnosticNeutral50','diagnosticNeutral75','diagnosticPrimaryTitle','diagnosticSecondaryTitle']){
  assert.match(PAGE,new RegExp('id="'+id+'"'));
 }
});
