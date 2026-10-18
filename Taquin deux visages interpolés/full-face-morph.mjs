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

export function createFullFaceMorph(first,second,skinTriangles,faceOval,{strength=.35}={}){
 if(!Array.isArray(first)||!Array.isArray(second)||first.length<468||second.length<468||
  !Array.isArray(faceOval)||faceOval.length<20||!Array.isArray(skinTriangles)||!skinTriangles.length||
  !Number.isFinite(strength)||strength<0||strength>1)return null;
 const count=Math.min(first.length,second.length,478);
 if(!Array.from({length:count},(_,i)=>finite(first[i])&&finite(second[i])).every(Boolean))return null;
 const a=clone(first.slice(0,count)),b=clone(second.slice(0,count));
 if(!a.every(finite)||!b.every(finite)||!faceOval.every(id=>Number.isInteger(id)&&id>=0&&id<count))return null;
 if([a,b].some(p=>Math.hypot(p[33].x-p[263].x,p[33].y-p[263].y)<1e-4||
  Math.hypot(p[61].x-p[291].x,p[61].y-p[291].y)<1e-4))return null;
 const middle=a.map((p,i)=>lerp(p,b[i],.5));
 const controls=[...new Set([...faceOval,...MOUTH_UPPER,...MOUTH_LOWER,...OUTER_LIPS,
  ...EYE_UPPER.flat(),...EYE_LOWER.flat(),...BROWS,...NOSE,...CHEEKS])].filter(id=>id<count);
 const source=controls.map(id=>middle[id]),destA=controls.map(id=>a[id]),destB=controls.map(id=>b[id]);
 // Precompute on the shared middle template, not per frame. Exact contours
 // remain controls; only the surrounding skin receives the smooth MLS field.
 const fixed=new Set(controls);
 const smoothA=middle.map((p,i)=>fixed.has(i)?a[i]:similarityMLS(p,source,destA));
 const smoothB=middle.map((p,i)=>fixed.has(i)?b[i]:similarityMLS(p,source,destB));
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
 const targetAt=(t,amount)=>t===0?clone(a):t===1?clone(b):a.map((p,i)=>{
  const raw=lerp(p,b[i],t);
  if(fixed.has(i)||amount===0||t===0||t===1)return raw;
  const smooth=lerp(smoothA[i],smoothB[i],t);
  return lerp(raw,smooth,4*t*(1-t)*amount);
 });
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
 return {regularization,controls:controls.slice(),triangles,
  sample(progress){
   if(!Number.isFinite(progress))return null;
   const t=Math.max(0,Math.min(1,progress));
   return {raw1:clone(a),raw2:clone(b),target:targetAt(t,regularization),
    triangles,t,textureMix:t,faceCount:count,regularization};
  }};
}
