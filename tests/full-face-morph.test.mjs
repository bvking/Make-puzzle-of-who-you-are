import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {similarityMLS,contourStrip,irisFan,createFullFaceMorph,assessSampledMorphPath,MOUTH_UPPER,MOUTH_LOWER,EYE_UPPER,EYE_LOWER} from '../Taquin deux visages interpolés/full-face-morph.mjs';

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

test('an iris fan covers a valid visible eye exactly and rejects a slit, external centre or invalid polygon',()=>{
 const upper=EYE_UPPER[0],lower=EYE_LOWER[0],points=structuredClone(faces[0]);
 upper.forEach((id,i)=>{points[id]={x:i,y:-Math.sin(Math.PI*i/(upper.length-1))}});
 lower.forEach((id,i)=>{points[id]={x:i,y:Math.sin(Math.PI*i/(lower.length-1))}});
 points[468]={x:4,y:0};
 const before=structuredClone(points),fan=irisFan(points,upper,lower,468),boundary=[...upper,...lower.slice(1,-1).reverse()];
 assert.equal(fan.length,boundary.length);assert.ok(fan.every(ids=>ids.includes(468)));
 const summed=fan.reduce((sum,ids)=>{const value=cross(...ids.map(id=>points[id]));assert.ok(value<0);return sum-value/2},0);
 const expected=Math.abs(boundary.reduce((sum,id,i)=>{const p=points[id],q=points[boundary[(i+1)%boundary.length]];return sum+p.x*q.y-p.y*q.x},0))/2;
 close(summed,expected);assert.deepEqual(points,before);
 const outside=structuredClone(points);outside[468]={x:4,y:2};assert.equal(irisFan(outside,upper,lower,468),null);
 const onEdge=structuredClone(points);onEdge[468]={...points[159]};assert.equal(irisFan(onEdge,upper,lower,468),null);
 const closed=points.map(p=>({...p,y:p.y*.001}));assert.equal(irisFan(closed,upper,lower,468),null);
 const crossed=structuredClone(points);[crossed[upper[2]],crossed[upper[6]]]=[crossed[upper[6]],crossed[upper[2]]];
 assert.equal(irisFan(crossed,upper,lower,468),null);
});

test('public open eyes use fixed iris-anchored topology with exact controls and reversible geometry',()=>{
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval),reverse=createFullFaceMorph(b,a,skin,oval),baseline=createFullFaceMorph(a,b,skin,oval,{strength:0});
 assert.deepEqual(model.eyeTopology,['iris-fan','iris-fan']);assert.deepEqual(model.irisAnchors,[468,473]);
 for(const id of model.irisAnchors){assert.ok(model.controls.includes(id));assert.ok(model.triangles.some(ids=>ids.includes(id)))}
 const topology=model.triangles;
 for(const t of [0,.01,.25,.5,.75,.99,1]){
  const sample=model.sample(t),opposite=reverse.sample(1-t),unregularized=baseline.sample(t);
  assert.equal(sample.triangles,topology);assert.equal(sample.eyeTopology,model.eyeTopology);
  for(const id of [468,473]){
   close(sample.target[id].x,unregularized.target[id].x);close(sample.target[id].y,unregularized.target[id].y);
   close(sample.target[id].x,opposite.target[id].x);close(sample.target[id].y,opposite.target[id].y);
  }
 }
 assert.deepEqual(model.sample(0).target,a);assert.deepEqual(model.sample(1).target,b);
 assert.throws(()=>{model.eyeTopology[0]='strip'},TypeError);assert.throws(()=>{model.irisAnchors[0]=0},TypeError);
});

test('closed, unavailable and unsafe intermediate iris geometry keeps the original strip for the whole pair',()=>{
 const [a,b]=structuredClone(faces),closed=structuredClone(b);
 EYE_LOWER[0].forEach((id,i)=>{closed[id]={...closed[EYE_UPPER[0][i]]}});
 const closedModel=createFullFaceMorph(a,closed,skin,oval);
 assert.deepEqual(closedModel.eyeTopology,['strip','iris-fan']);assert.ok(!closedModel.triangles.some(ids=>ids.includes(468)));
 const outside=structuredClone(b);outside[468]={x:b[33].x-300,y:b[33].y};
 assert.equal(createFullFaceMorph(a,outside,skin,oval).eyeTopology[0],'strip');
 assert.deepEqual(createFullFaceMorph(a.slice(0,468),b.slice(0,468),skin,oval).eyeTopology,['strip','strip']);
 const disabled=createFullFaceMorph(a,b,skin,oval,{irisAlignment:false});
 assert.deepEqual(disabled.eyeTopology,['strip','strip']);assert.deepEqual(disabled.irisAnchors,[]);
 // Both endpoint polygons individually support a fan, but reversing the
 // vertical ordering makes the midpoint collapse. Its fan must stay disabled.
 const upper=EYE_UPPER[0],lower=EYE_LOWER[0],first=structuredClone(a),second=structuredClone(a);
 for(const [contour,sign] of [[upper,-1],[lower,1]])contour.forEach((id,i)=>{
  first[id]={x:200+i*10,y:300+sign*10*Math.sin(Math.PI*i/(contour.length-1))};
  second[id]={x:first[id].x,y:600-first[id].y};
 });
 first[468]=second[468]={x:240,y:300};
 assert.ok(irisFan(first,upper,lower,468));assert.ok(irisFan(second,upper,lower,468));
 const model=createFullFaceMorph(first,second,skin,oval,{poseNormalization:false});
 assert.equal(model.eyeTopology[0],'strip');assert.ok(!model.controls.includes(468));
});

test('full-face geometry preserves both endpoints and moves semantic controls in the common face frame',()=>{
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval),baseline=createFullFaceMorph(a,b,skin,oval,{strength:0});
 assert.ok(model);
 assert.deepEqual(model.sample(0).target,a);assert.deepEqual(model.sample(1).target,b);
 const middle=model.sample(.5);
 for(const id of [33,263,1,61,291,13,14,152,10,234,454]){
  close(middle.target[id].x,baseline.sample(.5).target[id].x);
  close(middle.target[id].y,baseline.sample(.5).target[id].y);
  assert.ok(Math.hypot(middle.target[id].x-a[id].x,middle.target[id].y-a[id].y)>1e-4);
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
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval),unregularized=createFullFaceMorph(a,b,skin,oval,{strength:0});
 for(let step=0;step<=128;step++){
  const t=step/128,target=model.sample(t).target;
  const baseline=unregularized.sample(t).target;
  for(const ids of skin){
   const before=cross(...ids.map(id=>baseline[id])),after=cross(...ids.map(id=>target[id]));
   if(Math.abs(before)>1e-8)assert.ok(after/before>0);
  }
 }
});

test('a change of scale and camera roll preserves facial shape instead of collapsing it halfway',()=>{
 const a=faces[0],angle=Math.PI/2,scale=2;
 const transform=p=>({x:140+scale*(Math.cos(angle)*p.x-Math.sin(angle)*p.y),y:-75+scale*(Math.sin(angle)*p.x+Math.cos(angle)*p.y)});
 const b=a.map(transform),model=createFullFaceMorph(a,b,skin,oval);
 const center=a.reduce((c,p,i)=>[33,133,362,263].includes(i)?{x:c.x+p.x/4,y:c.y+p.y/4}:c,{x:0,y:0}),other=transform(center);
 for(const t of [.01,.25,.5,.75,.99]){
  const c={x:center.x*(1-t)+other.x*t,y:center.y*(1-t)+other.y*t},s=scale**t,rotation=angle*t,target=model.sample(t).target;
  for(let i=0;i<a.length;i++){
   const x=a[i].x-center.x,y=a[i].y-center.y;
   close(target[i].x,c.x+s*(Math.cos(rotation)*x-Math.sin(rotation)*y));
   close(target[i].y,c.y+s*(Math.sin(rotation)*x+Math.cos(rotation)*y));
  }
  for(const ids of skin)close(cross(...ids.map(id=>target[id]))/cross(...ids.map(id=>a[id])),s*s);
 }
});

test('the diagnostic baseline can reproduce direct pixel interpolation without pose normalization or MLS',()=>{
 const [a,b]=faces,model=createFullFaceMorph(a,b,skin,oval,{strength:0,poseNormalization:false,irisAlignment:false});
 assert.ok(model);
 for(const t of [0,.25,.5,.75,1]){
  const target=model.sample(t).target;
  for(let i=0;i<a.length;i++){
   close(target[i].x,a[i].x+(b[i].x-a[i].x)*t);
   close(target[i].y,a[i].y+(b[i].y-a[i].y)*t);
  }
  const context=model.interpolateContext(a.slice(0,3),b.slice(0,3),t);
  context.forEach((p,i)=>{close(p.x,target[i].x);close(p.y,target[i].y)});
 }
});

test('short rotation path and independent capture transforms remain symmetric when A and B are exchanged',()=>{
 const transform=(points,angle,scale,tx,ty)=>points.map(p=>({x:tx+scale*(Math.cos(angle)*p.x-Math.sin(angle)*p.y),y:ty+scale*(Math.sin(angle)*p.x+Math.cos(angle)*p.y)}));
 const a=transform(faces[0],170*Math.PI/180,.7,-200,90),b=transform(faces[1],-170*Math.PI/180,1.4,125,-400);
 const forward=createFullFaceMorph(a,b,skin,oval),reverse=createFullFaceMorph(b,a,skin,oval);
 assert.ok(forward&&reverse);assert.equal(forward.regularization,reverse.regularization);
 for(const t of [.01,.25,.5,.75,.99]){
  const f=forward.sample(t).target,r=reverse.sample(1-t).target;
  for(let i=0;i<a.length;i++){close(f[i].x,r[i].x);close(f[i].y,r[i].y)}
 }
 // The midpoint faces backwards near 180 degrees, rather than sweeping the
 // long 340-degree route and returning to the original orientation.
 const middle=forward.sample(.5).target;
 assert.ok(middle[263].x<middle[33].x);
});

test('head boundaries use the same pose as the facial outline while preserving exact endpoint buffers',()=>{
 const a=faces[0],b=a.map(p=>({x:30-1.3*p.y,y:-100+1.3*p.x}));
 const model=createFullFaceMorph(a,b,skin,oval),reverse=createFullFaceMorph(b,a,skin,oval);
 const first=oval.map(id=>a[id]),second=oval.map(id=>b[id]);
 assert.deepEqual(model.interpolateContext(first,second,0),first);
 assert.deepEqual(model.interpolateContext(first,second,1),second);
 for(const t of [.25,.5,.75]){
  const boundary=model.interpolateContext(first,second,t),backwards=reverse.interpolateContext(second,first,1-t),face=model.sample(t).target;
  boundary.forEach((p,i)=>{close(p.x,face[oval[i]].x);close(p.y,face[oval[i]].y);close(p.x,backwards[i].x);close(p.y,backwards[i].y)});
 }
 assert.equal(model.interpolateContext(first,second.slice(1),.5),null);
 assert.equal(model.interpolateContext(first,[...second.slice(1),null],.5),null);
 assert.equal(model.interpolateContext(first,second,NaN),null);
 const output=model.interpolateContext(first,second,0);output[0].x=-1;
 assert.equal(first[0].x,a[oval[0]].x);
});

test('sampled path quality detects nonlinear interior folds and collapses with area rather than triangle-count weighting',()=>{
 const first=[{x:0,y:0},{x:10,y:0},{x:0,y:10},{x:20,y:0},{x:21,y:0},{x:20,y:1}],triangles=[[0,1,2],[3,4,5]];
 const sample=height=>t=>first.map((p,i)=>i===2?{x:p.x,y:p.y*height(t)}:{...p});
 const folded=assessSampledMorphPath(first,first,triangles,sample(t=>1-2*Math.sin(Math.PI*t)));
 assert.equal(folded.valid,true);assert.equal(folded.samples,33);
 close(folded.flipArea,100/101);assert.equal(folded.collapseArea,0);
 const collapsed=assessSampledMorphPath(first,first,triangles,sample(t=>.02+.98*Math.abs(2*t-1)));
 assert.equal(collapsed.flipArea,0);close(collapsed.collapseArea,100/101);
 const safe=assessSampledMorphPath(first,first,triangles,()=>first,{steps:64});
 assert.deepEqual(safe,{valid:true,flipArea:0,collapseArea:0,triangles:2,samples:65});
 const mirrored=first.map(p=>({x:-p.x,y:p.y}));
 const endpointsOppose=assessSampledMorphPath(first,mirrored,triangles,t=>first.map((p,i)=>({x:p.x+(mirrored[i].x-p.x)*t,y:p.y})));
 assert.equal(endpointsOppose.flipArea,1);
});

test('path assessment fails closed for unusable areas, missing samples or invalid inputs',()=>{
 const first=[{x:0,y:0},{x:1,y:0},{x:0,y:1}],triangles=[[0,1,2]],flat=first.map(p=>({x:p.x,y:0}));
 const invalid=[
  assessSampledMorphPath(flat,flat,triangles,()=>flat),
  assessSampledMorphPath(first,first,triangles,()=>null),
  assessSampledMorphPath(first,first,triangles,()=>{throw new Error('missing frame')}),
  assessSampledMorphPath(first,first,[[0,1,999]],()=>first),
  assessSampledMorphPath(first,first,triangles,()=>first,{steps:0}),
 ];
 for(const result of invalid){assert.equal(result.valid,false);assert.ok(result.flipArea>.04||result.collapseArea>.08)}
});

test('model exposes the quality of its actual normalized and regularized trajectory for the caller safety gate',()=>{
 const a=faces[0],b=a.map(p=>({x:768-p.x,y:p.y})),model=createFullFaceMorph(a,b,skin,oval);
 assert.ok(model,'quality remains inspectable even for a mirrored correspondence');
 assert.ok(model.quality.flipArea>.04);
 assert.throws(()=>{model.quality.flipArea=0},TypeError);
 const publicPair=createFullFaceMorph(...faces,skin,oval);
 const assessed=assessSampledMorphPath(...faces,skin,t=>publicPair.sample(t).target);
 assert.deepEqual(publicPair.quality,assessed);
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
 assert.equal(createFullFaceMorph(...faces,skin,oval,{poseNormalization:'false'}),null);
 assert.equal(createFullFaceMorph(...faces,skin,oval,{irisAlignment:'false'}),null);
});
