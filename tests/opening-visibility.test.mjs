import test from 'node:test';
import assert from 'node:assert/strict';
import {MOUTH_UPPER,MOUTH_LOWER,EYE_UPPER,EYE_LOWER} from '../Taquin deux visages interpolés/full-face-morph.mjs';
import {createOpeningVisibility,openingTextureMix,openingMaskAlpha,openingTextureWeight} from '../Taquin deux visages interpolés/opening-visibility.mjs';

const close=(a,b,epsilon=1e-10)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
// Analytic synthetic cavities only: no person, photograph or scan is encoded.
function face({mouth=.22,left=.18,right=.18}={}){
 const points=Array.from({length:468},()=>({x:0,y:0}));
 for(const [upper,lower,cx,cy,width,height] of [
  [MOUTH_UPPER,MOUTH_LOWER,200,250,100,mouth],
  [EYE_UPPER[0],EYE_LOWER[0],155,150,60,left],
  [EYE_UPPER[1],EYE_LOWER[1],245,150,60,right]
 ]){
  for(const [chain,sign] of [[upper,-1],[lower,1]])chain.forEach((id,i)=>{
   const u=i/(chain.length-1);
   points[id]={x:cx+width*(u-.5),y:cy+sign*width*height*Math.sin(Math.PI*u)};
  });
 }
 return points;
}
const region=(sample,id='mouth')=>sample.regions.find(r=>r.id===id);
const transform=(points,scale,angle,dx,dy)=>points.map(p=>({
 x:dx+scale*(Math.cos(angle)*p.x-Math.sin(angle)*p.y),
 y:dy+scale*(Math.sin(angle)*p.x+Math.cos(angle)*p.y)
}));

test('an unseen cavity texture is strongly attenuated while equal visible openings retain the ordinary crossfade',()=>{
 const model=createOpeningVisibility(face({mouth:0}),face());
 const middle=region(model.sample(.5));
 assert.ok(middle.textureMix>.97&&middle.textureMix<1);
 assert.equal(region(createOpeningVisibility(face(),face()).sample(.5)).textureMix,.5);
 assert.equal(openingTextureMix(.25,.2,.3),.25,'both clearly visible sources remain equally reliable');
 assert.equal(openingTextureMix(.75,0,0),.75,'two invisible cavities cannot provide unseen texture');
 // Eye closure is independent from the mouth and the other eye.
 const eyes=createOpeningVisibility(face({left:0}),face());
 const sample=eyes.sample(.5);
 assert.ok(region(sample,'eye-left').textureMix>.97);
 assert.equal(region(sample,'eye-right').textureMix,.5);
 assert.equal(region(sample).textureMix,.5);
});

test('local texture weights are continuous, monotonic, bounded and exact at both identity endpoints',()=>{
 for(const [a,b] of [[0,.3],[.3,0],[0,0],[.04,.09],[.3,.3]]){
  assert.equal(openingTextureMix(0,a,b),0);
  assert.equal(openingTextureMix(1,a,b),1);
  let previous=0;
  for(let i=0;i<=10000;i++){
   const mix=openingTextureMix(i/10000,a,b);
   assert.ok(mix>=previous&&mix>=0&&mix<=1);
   assert.ok(mix-previous<.005,'positive reliability floor avoids a hard source switch');
   previous=mix;
  }
  assert.ok(openingTextureMix(1e-8,a,b)<1e-6);
  assert.ok(1-openingTextureMix(1-1e-8,a,b)<1e-6);
 }
});

test('swapping identities reverses geometry, masks and texture weights at every sampled position',()=>{
 const a=face({mouth:0,left:.01}),b=face({mouth:.3,right:.02});
 const forward=createOpeningVisibility(a,b),reverse=createOpeningVisibility(b,a);
 for(const t of [0,.000001,.1,.25,.5,.75,.9,.999999,1]){
  const f=forward.sample(t),r=reverse.sample(1-t);
  assert.deepEqual(f.regions.map(p=>p.id),r.regions.map(p=>p.id));
  for(let i=0;i<f.regions.length;i++){
   const x=f.regions[i],y=r.regions[i];
   close(x.textureMix,1-y.textureMix);
   close(x.feather,y.feather);
   for(let j=0;j<x.contour.length;j++){
    close(x.contour[j].x,y.contour[j].x);close(x.contour[j].y,y.contour[j].y);
   }
  }
  for(const p of [{x:200,y:250},{x:155,y:150},{x:245,y:150},{x:200,y:210}]){
   close(openingTextureWeight(f,p),1-openingTextureWeight(r,p));
  }
 }
});

test('opening reliability ignores independent source framing, in-plane rotation and scale',()=>{
 const a=face({mouth:.005,left:.005}),b=face({mouth:.3});
 const baseline=createOpeningVisibility(a,b).sample(.35);
 const transformed=createOpeningVisibility(transform(a,3.7,.7,400,-200),transform(b,.4,-.2,-50,90)).sample(.35,a);
 for(const expected of baseline.regions){
  const actual=region(transformed,expected.id);
  close(actual.apertureA,expected.apertureA);
  close(actual.apertureB,expected.apertureB);
  close(actual.textureMix,expected.textureMix);
 }
});

test('masks stay strictly inside observed cavities and never accelerate lip, eyelid, cheek or forehead texture',()=>{
 const a=face({mouth:0,left:0}),b=face(),sample=createOpeningVisibility(a,b).sample(.5,b);
 for(const r of sample.regions){
  for(const point of r.contour){
   close(openingMaskAlpha(r,point),0);
   close(openingTextureWeight(sample,point),sample.t);
  }
  for(const p of r.contour){
   assert.ok(p.x>=r.bounds.minX&&p.x<=r.bounds.maxX&&p.y>=r.bounds.minY&&p.y<=r.bounds.maxY);
  }
 }
 const mouth=region(sample);
 assert.equal(openingMaskAlpha(mouth,{x:200,y:250}),1);
 assert.ok(openingTextureWeight(sample,{x:200,y:250})>.97);
 for(const point of [{x:200,y:225},{x:200,y:275},{x:90,y:250},{x:200,y:200},{x:200,y:100}]){
  assert.equal(openingMaskAlpha(mouth,point),0);
  assert.equal(openingTextureWeight(sample,point),.5);
 }
 // Geometric scale also scales feathering; it cannot change the opacity mask.
 const scaled=createOpeningVisibility(transform(a,2,.3,10,20),transform(b,2,.3,10,20)).sample(.5,transform(b,2,.3,10,20));
 const p={x:200,y:230},q=transform([p],2,.3,10,20)[0];
 close(openingMaskAlpha(mouth,p),openingMaskAlpha(region(scaled),q));
});

test('a cavity fades in from zero area without a first-pixel source jump',()=>{
 const model=createOpeningVisibility(face({mouth:0}),face());
 const middle={x:200,y:250};
 const closed=model.sample(0);
 assert.equal(region(closed),undefined);
 assert.equal(openingTextureWeight(closed,middle),0);
 let previousCorrection=0;
 for(const t of [1e-8,1e-7,1e-6,1e-5,1e-4,.001,.005]){
  const sample=model.sample(t),correction=openingTextureWeight(sample,middle)-t;
  assert.ok(correction>=previousCorrection-1e-12);
  if(t<=1e-5)assert.ok(correction<1e-8);
  previousCorrection=correction;
 }
 const narrow=model.sample(.01);
 assert.ok(openingMaskAlpha(region(narrow),middle)>.9,'small but visible cavity has a selected core without a geometric inset');
});

test('renderer-provided target contours and sampled data cannot mutate source geometry or future samples',()=>{
 const a=face({mouth:0}),b=face(),target=face({mouth:.1}),before=structuredClone([a,b,target]);
 const model=createOpeningVisibility(a,b),sample=model.sample(.4,target),expected=model.sample(.4,target);
 assert.deepEqual(region(sample).contour[0],target[MOUTH_UPPER[0]]);
 sample.regions[0].contour[0].x=999;sample.regions[0].bounds.minX=999;
 assert.deepEqual([a,b,target],before);
 assert.deepEqual(model.sample(.4,target),expected);
 a[78].x=999;b[78].x=999;
 assert.deepEqual(model.sample(.4,target),expected,'constructor snapshots relevant source coordinates');
});

test('invalid or collapsed geometry is rejected locally without leaking invalid weights',()=>{
 assert.equal(createOpeningVisibility(null,face()),null);
 assert.equal(createOpeningVisibility([],[]),null);
 assert.equal(createOpeningVisibility(Array(468).fill({x:1,y:1}),face()),null);
 for(const options of [{minReliability:0},{minReliability:2},{closed:.2},{minFeather:0},{maxFeather:NaN}]){
  assert.equal(createOpeningVisibility(face(),face(),options),null);
 }
 const a=face();a[33].x=NaN;
 const model=createOpeningVisibility(a,face());
 assert.deepEqual(model.sample(.5).regions.map(r=>r.id),['mouth','eye-right']);
 assert.equal(model.sample(NaN),null);assert.equal(model.sample(.5,{}),null);
 assert.deepEqual(model.sample(.5,[]).regions,[]);
 assert.equal(openingTextureMix(NaN,0,.1),null);
 assert.equal(openingTextureMix(.5,-1,.1),null);
 assert.equal(openingMaskAlpha(null,{x:1,y:1}),0);
 assert.equal(openingTextureWeight(null,{x:1,y:1}),null);
 assert.equal(openingTextureWeight(model.sample(.5),{x:NaN,y:1}),null);
});
