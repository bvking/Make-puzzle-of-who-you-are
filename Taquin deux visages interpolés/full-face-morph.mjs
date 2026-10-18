// Full cross-identity morph geometry. Canonical image pixels in, geometry out.
// All features travel from A to B; no texture, capture or landmark is stored.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const clone=points=>points.map(p=>({x:p.x,y:p.y}));

export const MOUTH_UPPER=[78,191,80,81,82,13,312,311,310,415,308];
export const MOUTH_LOWER=[78,95,88,178,87,14,317,402,318,324,308];
export const EYE_UPPER=[[33,246,161,160,159,158,157,173,133],[362,398,384,385,386,387,388,466,263]];
export const EYE_LOWER=[[33,7,163,144,145,153,154,155,133],[362,382,381,380,374,373,390,249,263]];
const OUTER_LIPS=[61,40,37,0,267,270,291,321,314,17,84,91];
const BROWS=[70,63,105,66,107,55,65,52,53,46,300,293,334,296,336,285,295,282,283,276];
const NOSE=[168,6,197,195,5,4,1,2,98,327];
const CHEEKS=[50,101,205,206,207,187,123,280,330,425,426,427,411,352];

// Separate a camera's 2D scale/roll from facial shape before interpolating it.
// Eye corners are used rather than the iris/eyelid centres: a blink or an open
// mouth must not change the frame. This does not estimate 3D camera perspective.
function faceFrame(points){
 const left=lerp(points[33],points[133],.5),right=lerp(points[362],points[263],.5);
 const x=right.x-left.x,y=right.y-left.y,scale=Math.hypot(x,y);
 if(!Number.isFinite(scale)||scale<1e-4)return null;
 return {center:lerp(left,right,.5),scale,angle:Math.atan2(y,x)};
}
function normalizeFace(points,frame){
 const c=Math.cos(frame.angle),s=Math.sin(frame.angle);
 return points.map(p=>{const x=(p.x-frame.center.x)/frame.scale,y=(p.y-frame.center.y)/frame.scale;
  return {x:c*x+s*y,y:-s*x+c*y};
 });
}
function interpolateFrame(a,b,t){
 const difference=b.angle-a.angle,turn=Math.atan2(Math.sin(difference),Math.cos(difference));
 const angle=a.angle+t*turn,scale=Math.exp((1-t)*Math.log(a.scale)+t*Math.log(b.scale));
 return {center:lerp(a.center,b.center,t),scale,c:Math.cos(angle),s:Math.sin(angle)};
}
function placeFace(point,frame){
 return {x:frame.center.x+frame.scale*(frame.c*point.x-frame.s*point.y),
  y:frame.center.y+frame.scale*(frame.s*point.x+frame.c*point.y)};
}

// Pair corresponding upper/lower contour segments. Unlike unconstrained
// Delaunay, these strips cannot connect non-neighbouring parts of an opening.
export function contourStrip(upper,lower){
 if(upper.length!==lower.length||upper.length<2)throw new Error('Contours incompatibles');
 const out=[];
 for(let i=0;i<upper.length-1;i++)for(const ids of [
  [upper[i],lower[i],upper[i+1]],[upper[i+1],lower[i],lower[i+1]]
 ])if(new Set(ids).size===3)out.push(ids);
 return out;
}

// Similarity Moving Least Squares (Schaefer et al., 2006). Weights are
// normalized and computed in local coordinates for scale/translation stability.
export function similarityMLS(point,source,target){
 if(!finite(point)||!Array.isArray(source)||!Array.isArray(target)||
  source.length!==target.length||source.length<2||!source.every(finite)||!target.every(finite))return null;
 const distances=source.map(p=>Math.hypot(p.x-point.x,p.y-point.y));
 const nearest=Math.min(...distances),hit=distances.indexOf(0);
 if(hit>=0)return {...target[hit]};
 const weights=distances.map(d=>(nearest/d)**2),sum=weights.reduce((a,b)=>a+b,0);
 const px=source.reduce((v,p,i)=>v+(p.x-point.x)*weights[i]/sum,0);
 const py=source.reduce((v,p,i)=>v+(p.y-point.y)*weights[i]/sum,0);
 const anchor=target[0];
 const qx=target.reduce((v,p,i)=>v+(p.x-anchor.x)*weights[i]/sum,0);
 const qy=target.reduce((v,p,i)=>v+(p.y-anchor.y)*weights[i]/sum,0);
 let mu=0,a=0,b=0;
 for(let i=0;i<source.length;i++){
  const x=source[i].x-point.x-px,y=source[i].y-point.y-py;
  const u=target[i].x-anchor.x-qx,v=target[i].y-anchor.y-qy,w=weights[i]/sum;
  mu+=w*(x*x+y*y);a+=w*(x*u+y*v);b+=w*(x*v-y*u);
 }
 if(!Number.isFinite(mu)||mu<=Number.EPSILON*nearest*nearest)return null;
 const result={x:anchor.x+qx+(-a*px+b*py)/mu,y:anchor.y+qy+(-b*px-a*py)/mu};
 return finite(result)?result:null;
}

// Inspect the path actually rendered, including nonlinear pose/MLS motion.
// Each triangle is weighted by the mean of its two endpoint areas, so a tiny
// eyelid triangle cannot outweigh an entire cheek. Sampling cannot certify
// what happens between positions; callers must keep that limitation visible.
export function assessSampledMorphPath(first,second,triangles,targetAt,{steps=32}={}){
 const invalid=()=>({valid:false,flipArea:1,collapseArea:1,triangles:0,samples:0});
 if(!Array.isArray(first)||!Array.isArray(second)||!Array.isArray(triangles)||!triangles.length||
  typeof targetAt!=='function'||!Number.isInteger(steps)||steps<1||steps>4096)return invalid();
 const entries=[];let largestWeight=0;
 for(const ids of triangles){
  if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||
   !ids.every(id=>Number.isInteger(id)&&id>=0&&finite(first[id])&&finite(second[id])))return invalid();
  const start=area(...ids.map(id=>first[id])),end=area(...ids.map(id=>second[id]));
  if(!Number.isFinite(start)||!Number.isFinite(end))return invalid();
  const maximum=Math.max(Math.abs(start),Math.abs(end)),weight=(Math.abs(start)/2+Math.abs(end)/2);
  // An everywhere-degenerate mesh has no meaningful area weights and fails
  // closed below. Zero-area pieces alongside usable triangles contribute zero.
  if(weight===0)continue;
  const orientation=Math.sign(Math.abs(start)>=Math.abs(end)?start:end);
  entries.push({ids,weight,maximum,orientation,minArea:Math.min(Math.abs(start),Math.abs(end)),
   flipped:start*orientation<0||end*orientation<0});
  largestWeight=Math.max(largestWeight,weight);
 }
 if(!entries.length||!Number.isFinite(largestWeight)||largestWeight<=0)return invalid();
 try{
  for(let step=0;step<=steps;step++){
   const target=targetAt(step/steps);if(!Array.isArray(target))return invalid();
   for(const entry of entries){
    const points=entry.ids.map(id=>target[id]);if(!points.every(finite))return invalid();
    const value=area(...points);if(!Number.isFinite(value))return invalid();
    entry.minArea=Math.min(entry.minArea,Math.abs(value));
    entry.flipped ||= value*entry.orientation<0;
   }
  }
 }catch{return invalid()}
 let total=0,flipped=0,collapsed=0;
 for(const entry of entries){
  const weight=entry.weight/largestWeight;total+=weight;
  if(entry.flipped)flipped+=weight;
  else if(entry.minArea/entry.maximum<.025)collapsed+=weight;
 }
 return {valid:true,flipArea:flipped/total,collapseArea:collapsed/total,triangles:entries.length,samples:steps+1};
}

export function createFullFaceMorph(first,second,skinTriangles,faceOval,{strength=.35,poseNormalization=true}={}){
 if(!Array.isArray(first)||!Array.isArray(second)||first.length<468||second.length<468||
  !Array.isArray(faceOval)||faceOval.length<20||!Array.isArray(skinTriangles)||!skinTriangles.length||
  !Number.isFinite(strength)||strength<0||strength>1||typeof poseNormalization!=='boolean')return null;
 const count=Math.min(first.length,second.length,478);
 if(!Array.from({length:count},(_,i)=>finite(first[i])&&finite(second[i])).every(Boolean))return null;
 const a=clone(first.slice(0,count)),b=clone(second.slice(0,count));
 if(!a.every(finite)||!b.every(finite)||!faceOval.every(id=>Number.isInteger(id)&&id>=0&&id<count))return null;
 if([a,b].some(p=>Math.hypot(p[33].x-p[263].x,p[33].y-p[263].y)<1e-4||
  Math.hypot(p[61].x-p[291].x,p[61].y-p[291].y)<1e-4))return null;
 const frameA=poseNormalization?faceFrame(a):null,frameB=poseNormalization?faceFrame(b):null;
 if(poseNormalization&&(!frameA||!frameB))return null;
 const shapeA=poseNormalization?normalizeFace(a,frameA):a,shapeB=poseNormalization?normalizeFace(b,frameB):b;
 const middle=shapeA.map((p,i)=>lerp(p,shapeB[i],.5));
 const controls=[...new Set([...faceOval,...MOUTH_UPPER,...MOUTH_LOWER,...OUTER_LIPS,
  ...EYE_UPPER.flat(),...EYE_LOWER.flat(),...BROWS,...NOSE,...CHEEKS])].filter(id=>id<count);
 const source=controls.map(id=>middle[id]),destA=controls.map(id=>shapeA[id]),destB=controls.map(id=>shapeB[id]);
 // Precompute on the shared middle template, not per frame. Exact contours
 // remain controls; only the surrounding skin receives the smooth MLS field.
 const fixed=new Set(controls);
 const smoothA=middle.map((p,i)=>fixed.has(i)?shapeA[i]:similarityMLS(p,source,destA));
 const smoothB=middle.map((p,i)=>fixed.has(i)?shapeB[i]:similarityMLS(p,source,destB));
 if(smoothA.some(p=>!p)||smoothB.some(p=>!p))return null;
 const skin=[],seen=new Set();
 for(const ids of skinTriangles){
  if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||
   !ids.every(id=>Number.isInteger(id)&&id>=0&&id<468))return null;
  const key=ids.slice().sort((x,y)=>x-y).join('-');
  if(!seen.has(key)){seen.add(key);skin.push(ids.slice())}
 }
 const openings=[...EYE_UPPER.map((upper,i)=>contourStrip(upper,EYE_LOWER[i])),contourStrip(MOUTH_UPPER,MOUTH_LOWER)];
 const triangles=Object.freeze(skin.concat(...openings).map(ids=>Object.freeze(ids)));
 const targetAt=(t,amount)=>{
  if(t===0)return clone(a);if(t===1)return clone(b);
  const frame=poseNormalization?interpolateFrame(frameA,frameB,t):null;
  return shapeA.map((p,i)=>{
   const raw=lerp(p,shapeB[i],t);
   const shape=fixed.has(i)||amount===0?raw:lerp(raw,lerp(smoothA[i],smoothB[i],t),4*t*(1-t)*amount);
   return frame?placeFace(shape,frame):shape;
  });
 };
 // A sampled guard compares against the unregularized path. It bounds added
 // inversions/collapses, but is not a mathematical proof between sample times.
 const references=Array.from({length:33},(_,i)=>{
  const target=targetAt(i/32,0);return skin.map(ids=>area(...ids.map(id=>target[id])));
 });
 let regularization=strength;
 const safe=amount=>references.every((areas,step)=>{
  const target=targetAt(step/32,amount);
  return skin.every((ids,index)=>{
   const baseline=areas[index],next=area(...ids.map(id=>target[id]));
   return Number.isFinite(next)&&(Math.abs(baseline)<1e-8||next/baseline>=.2);
  });
 });
 while(regularization>1e-4&&!safe(regularization))regularization/=2;
 if(regularization<=1e-4)regularization=0;
 const quality=Object.freeze(assessSampledMorphPath(a,b,skin,t=>targetAt(t,regularization)));
 return {regularization,controls:controls.slice(),triangles,quality,
  // Hair/head boundary points need the same pose path as the face. The outer
  // image boundary remains the renderer's fixed frame and must not use this.
  interpolateContext(firstContext,secondContext,progress){
   if(!Number.isFinite(progress)||!Array.isArray(firstContext)||!Array.isArray(secondContext)||
    firstContext.length!==secondContext.length||!firstContext.every(finite)||!secondContext.every(finite))return null;
   const t=Math.max(0,Math.min(1,progress));
   if(t===0)return clone(firstContext);if(t===1)return clone(secondContext);
   if(!poseNormalization)return firstContext.map((p,i)=>lerp(p,secondContext[i],t));
   const contextA=normalizeFace(firstContext,frameA),contextB=normalizeFace(secondContext,frameB),frame=interpolateFrame(frameA,frameB,t);
   return contextA.map((p,i)=>placeFace(lerp(p,contextB[i],t),frame));
  },
  sample(progress){
   if(!Number.isFinite(progress))return null;
   const t=Math.max(0,Math.min(1,progress));
   return {raw1:clone(a),raw2:clone(b),target:targetAt(t,regularization),
    triangles,t,textureMix:t,faceCount:count,regularization};
  }};
}
