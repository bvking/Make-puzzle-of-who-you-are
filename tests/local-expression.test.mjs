import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localMaskFeatures,localAppearanceMix,mouthOpeningRatio,outerLipEnvelope,OUTER_LIP_CONTOUR} from '../Taquin deux visages interpolés/local-expression.mjs';

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

test('mouth-specific appearance remains monotone with exact 25/50/75 geometry',()=>{
 const a=face(),b=face();
 a[13]={x:377,y:518};a[14]={x:377,y:520}; // closed 2px
 b[13]={x:377,y:480};b[14]={x:377,y:650}; // strongly open 170px
 assert.ok(mouthOpeningRatio(b)>mouthOpeningRatio(a)+.5);
 const progress=[0,.25,.5,.75,1];
 const appearance=progress.map(t=>localAppearanceMix(t,a,b));
 assert.equal(appearance[0],0);assert.equal(appearance.at(-1),1);
 assert.ok(appearance[1]>=.25&&appearance[1]<.4);
 assert.ok(appearance[2]>.65&&appearance[3]>.87);
 for(let i=0;i<=100;i++){
  const t=i/100,prev=Math.max(0,t-.01);
  assert.ok(localAppearanceMix(t,a,b)>=localAppearanceMix(prev,a,b)-1e-9,
   'appearance must not reverse at '+t);
 }
 // Closing the mouth should be time reversal of opening it.
 for(const t of progress)assert.ok(Math.abs(localAppearanceMix(t,b,a)-
   (1-localAppearanceMix(1-t,a,b)))<1e-9);
});

test('similar expressions and missing data preserve ordinary interpolation',()=>{
 const a=face(),b=face();
 for(const t of [0,.25,.5,.75,1]){
  assert.equal(localAppearanceMix(t,a,b),t);
  assert.equal(localAppearanceMix(t,null,b),t);
 }
});

test('local renderer separates appearance and exact mesh geometry in WebGL and Canvas',()=>{
 assert.match(PAGE,/const textureMix=localAppearanceMix\(v\.a,geometry\.raw1,geometry\.alignedSecond\)/);
 assert.match(PAGE,/const texturedGeometry=\{\.\.\.geometry,textureMix\}/);
 assert.match(PAGE,/renderWebGLFace\(canvas\.width,texturedGeometry\)/);
 assert.match(PAGE,/renderCanvasMorph\(layer,v,texturedGeometry\)/);
 assert.match(PAGE,/blendMorphPixels\(pixelsA\.data,pixelsB\.data,geometry\.textureMix\?\?geometry\.t,pixelsA\.data,openingMixMap\(geometry,size\)\?\.weights\)/);
 assert.match(PAGE,/gl\.uniform1f\(r\.locations\.mix,geometry\.textureMix\?\?geometry\.t\)/);
 assert.match(PAGE,/geometry=localized\?stabilizedGeometry\(v\)/);
 assert.match(PAGE,/Math\.abs\(geometry\.t-position\/100\)>1e-8/);
});

test('outer lip envelope includes both source and target contours, even for extreme mouth openings',()=>{
 const A=face(),B=face(),middle=face();
 // Simulate moving upper/lower lips, chin, camera translation, and asymmetric smile.
 for(const id of OUTER_LIP_CONTOUR){
  A[id]={x:350+(id%11)*3,y:500+(id%7)*4};
  B[id]={x:370+(id%13)*4,y:480+(id%17)*9};
 }
 const envelope=outerLipEnvelope(middle,A,B);
 assert.ok(envelope&&envelope.rx>0&&envelope.ry>0);
 for(const p of [middle,A,B])for(const id of OUTER_LIP_CONTOUR){
  const pt=p[id],nx=(pt.x-envelope.x)/envelope.rx,ny=(pt.y-envelope.y)/envelope.ry;
  assert.ok(nx*nx+ny*ny<=1+1e-9,'lip must stay under seam-safe overlay');
 }
});

test('seam overlay stays in the local mask, not in legacy modes',()=>{
 assert.match(PAGE,/const seam=outerLipEnvelope\(points,referencePoints,alignedPoints\)/);
 assert.match(PAGE,/seal\.addColorStop\(\.72,'rgba\(255,255,255,1\)'\)/);
 assert.match(PAGE,/const mask=getBuffer\('local-expression-mask'/);
});
