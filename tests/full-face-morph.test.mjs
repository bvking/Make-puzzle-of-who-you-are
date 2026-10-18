import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {similarityMLS,contourStrip,createFullFaceMorph,MOUTH_UPPER,MOUTH_LOWER,EYE_UPPER,EYE_LOWER} from '../Taquin deux visages interpolés/full-face-morph.mjs';

// Existing public demo fixture, not a user capture.
const fixture=JSON.parse(readFileSync(new URL('../Taquin deux visages interpolés/qa/portrait-landmarks.json',import.meta.url),'utf8'));
const faces=['visage_homme.png','visage_femme.png'].map(name=>fixture[name].map(p=>({x:p.x*768,y:p.y*768})));
const oval=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const skin=[[10,338,297],[50,101,205],[116,117,118],[9,107,336],[123,116,117]];
const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

test('similarity MLS reproduces identity, scale, rotation and translation between controls',()=>{
 const points=[{x:0,y:0},{x:100,y:0},{x:0,y:100},{x:100,y:100}];
 const transforms=[p=>({...p}),p=>({x:2*p.x+17,y:2*p.y-34}),p=>({x:20+.8*p.x-.6*p.y,y:10+.6*p.x+.8*p.y})];
 for(const transform of transforms)for(const point of [...points,{x:37,y:61},{x:-50,y:175}]){
  const actual=similarityMLS(point,points,points.map(transform)),expected=transform(point);
  close(actual.x,expected.x);close(actual.y,expected.y);
 }
 assert.equal(similarityMLS(null,points,points),null);
 assert.equal(similarityMLS(points[0],[],[]),null);
});

test('ordered aperture strips cover the opening without crossing the lip or eyelid boundary',()=>{
 for(const [upper,lower] of [[MOUTH_UPPER,MOUTH_LOWER],...EYE_UPPER.map((p,i)=>[p,EYE_LOWER[i]])]){
  const points=[];
  upper.forEach((id,i)=>{points[id]={x:i,y:-Math.sin(Math.PI*i/(upper.length-1))*5}});
  lower.forEach((id,i)=>{points[id]={x:i,y:Math.sin(Math.PI*i/(lower.length-1))*5}});
  const tris=contourStrip(upper,lower);
  assert.equal(tris.length,2*(upper.length-2));
  let total=0;
  for(const ids of tris){const a=cross(...ids.map(id=>points[id]));assert.ok(a<0);total+=-a/2}
  const contour=[...upper,...lower.slice(1,-1).reverse()].map(id=>points[id]);
  const area=Math.abs(contour.reduce((s,p,i)=>{const next=contour[(i+1)%contour.length];return s+p.x*next.y-p.y*next.x},0))/2;
  close(total,area);
 }
});

test('full-face geometry preserves both endpoints and moves eyes, nose, mouth and outline to B',()=>{
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval);
 assert.ok(model);
 assert.deepEqual(model.sample(0).target,a);assert.deepEqual(model.sample(1).target,b);
 const middle=model.sample(.5);
 for(const id of [33,263,1,61,291,13,14,152,10,234,454]){
  close(middle.target[id].x,(a[id].x+b[id].x)/2);
  close(middle.target[id].y,(a[id].y+b[id].y)/2);
 }
 assert.equal(middle.textureMix,.5,'global texture amount follows geometry');
 assert.equal(model.sample(NaN),null);
});

test('MLS skin regularization is present, reversible and never pins the identity to A',()=>{
 const [a,b]=faces,forward=createFullFaceMorph(a,b,skin,oval),reverse=createFullFaceMorph(b,a,skin,oval);
 assert.ok(forward.regularization>0&&forward.regularization<=.35);
 assert.equal(forward.regularization,reverse.regularization);
 const quarter=forward.sample(.25),controls=new Set(forward.controls);
 assert.ok(quarter.target.some((p,i)=>!controls.has(i)&&Math.hypot(p.x-(.75*a[i].x+.25*b[i].x),p.y-(.75*a[i].y+.25*b[i].y))>1e-5));
 for(const t of [0,.01,.25,.5,.75,.99,1]){
  const f=forward.sample(t),r=reverse.sample(1-t);
  for(let i=0;i<a.length;i++){close(f.target[i].x,r.target[i].x);close(f.target[i].y,r.target[i].y)}
 }
});

test('regularization does not introduce a skin fold relative to the baseline on a dense sampled path',()=>{
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval);
 for(let step=0;step<=128;step++){
  const t=step/128,target=model.sample(t).target;
  const baseline=a.map((p,i)=>({x:p.x+(b[i].x-p.x)*t,y:p.y+(b[i].y-p.y)*t}));
  for(const ids of skin){
   const before=cross(...ids.map(id=>baseline[id])),after=cross(...ids.map(id=>target[id]));
   if(Math.abs(before)>1e-8)assert.ok(after/before>0);
  }
 }
});

test('source geometry and sampled buffers cannot mutate another sample or a later model',()=>{
 const [a,b]=structuredClone(faces),before=structuredClone([a,b]);
 const model=createFullFaceMorph(a,b,skin,oval),sample=model.sample(.5),expected=model.sample(.5);
 sample.target[33].x=-1000;sample.raw1[61].x=-2000;a[10].x=-3000;
 assert.throws(()=>{sample.triangles[0][0]=999},TypeError);
 assert.deepEqual(model.sample(.5),expected);
 assert.deepEqual(b,before[1]);assert.deepEqual(a.slice(11),before[0].slice(11));
});

test('incomplete, degenerate or invalid inputs are refused without throwing',()=>{
 for(const a of [null,[],Array(478),Array(478).fill(null),Array.from({length:478},()=>({x:0,y:0}))])assert.equal(createFullFaceMorph(a,faces[1],skin,oval),null);
 assert.equal(createFullFaceMorph(...faces,[[0,1,999]],oval),null);
 assert.equal(createFullFaceMorph(...faces,skin,[999,...oval]),null);
 assert.equal(createFullFaceMorph(...faces,skin,oval,{strength:NaN}),null);
});
