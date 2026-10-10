// Robust 2-D face-image alignment for handheld mobile captures.
// Keeps mouth, cheeks and jaw out of the camera-movement estimate.
// All coordinates use the canonical input image's pixel space.
export const STABLE_ANCHORS=[
 [33,5],[133,6],[362,6],[263,5], // inner/outer eye corners
 [168,5],[6,4],[197,3],[195,3], // nose bridge
 [4,2],[1,2],[5,2],              // tip and central nose
 [98,1.5],[327,1.5],             // nostril wings (limited reliability in yaw)
 [94,1.5],[2,1.5]
];
const hypot=Math.hypot;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
export function applySimilarity(p,t){
 const x=p.x*t.a-p.y*t.b+t.tx,y=p.x*t.b+p.y*t.a+t.ty;
 return {x,y};
}
export function weightedFit(src,dst,weights){
 if(src.length!==dst.length||src.length!==weights.length||src.length<3)return null;
 let sum=0,sx=0,sy=0,dx=0,dy=0;
 for(let i=0;i<src.length;i++){
  const w=weights[i];
  if(!finite(src[i])||!finite(dst[i])||!Number.isFinite(w)||w<0)return null;
  sum+=w;sx+=w*src[i].x;sy+=w*src[i].y;dx+=w*dst[i].x;dy+=w*dst[i].y;
 }
 if(sum<=0)return null;sx/=sum;sy/=sum;dx/=sum;dy/=sum;
 let a=0,b=0,den=0;
 for(let i=0;i<src.length;i++){
  const w=weights[i],x=src[i].x-sx,y=src[i].y-sy,u=dst[i].x-dx,v=dst[i].y-dy;
  a+=w*(x*u+y*v);b+=w*(x*v-y*u);den+=w*(x*x+y*y);
 }
 if(den<1e-8)return null;
 a/=den;b/=den;
 const scale=hypot(a,b);
 if(!Number.isFinite(scale)||scale<1e-5)return null;
 return {a,b,tx:dx-a*sx+b*sy,ty:dy-b*sx-a*sy,scale,roll:Math.atan2(b,a)};
}
function median(a){
 const sorted=a.slice().sort((x,y)=>x-y),mid=sorted.length>>1;
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
export function robustStableAlignment(first,second,size=768){
 if(!Array.isArray(first)||!Array.isArray(second)||!Number.isFinite(size)||size<=0)return null;
 const anchors=STABLE_ANCHORS.map(([id,weight])=>{
  const a=first[id],b=second[id];
  return a&&b&&finite(a)&&finite(b)?{
   id,weight,ref:{x:a.x*size,y:a.y*size},src:{x:b.x*size,y:b.y*size}
  }:null;
 }).filter(Boolean);
 if(anchors.length<10)return null;
 const src=anchors.map(a=>a.src),dst=anchors.map(a=>a.ref),base=anchors.map(a=>a.weight);
 let fit=weightedFit(src,dst,base);
 if(!fit)return null;
 // Reweight aberrant correspondences but never turn a single feature
 // into a camera-wide translation: the eye and nose anchors remain.
 for(let iteration=0;iteration<3;iteration++){
  const residuals=anchors.map(a=>hypot(
   applySimilarity(a.src,fit).x-a.ref.x,applySimilarity(a.src,fit).y-a.ref.y
  ));
  const robustScale=Math.max(1.5,median(residuals)*1.4826);
  const threshold=Math.max(4,2.5*robustScale);
  const weights=base.map((w,i)=>w*Math.min(1,threshold/Math.max(.001,residuals[i])));
  const next=weightedFit(src,dst,weights);
  if(!next)return null;fit=next;
 }
 const residuals=anchors.map(a=>hypot(
  applySimilarity(a.src,fit).x-a.ref.x,applySimilarity(a.src,fit).y-a.ref.y
 ));
 const rms=Math.sqrt(residuals.reduce((acc,r,i)=>acc+base[i]*r*r,0)/base.reduce((a,b)=>a+b,0));
 const distance=(a,b)=>hypot((a.x-b.x)*size,(a.y-b.y)*size);
 const eyeSpan=first[33]&&first[263]?distance(first[33],first[263]):size*.25;
 const normalizedRms=rms/Math.max(1,eyeSpan),rollDegrees=fit.roll*180/Math.PI;
 // A 2-D transform cannot recover surfaces hidden by changed camera angle.
 const reliable=fit.scale>=.50&&fit.scale<=2&&normalizedRms<.25;
 const warning=!reliable?'Écart important : la vue manquante ne peut pas être reconstruite en 2D.':normalizedRms>.13?'Inclinaison/perspective résiduelle : contour et oreilles peuvent être approximatifs.':'';
 return {...fit,rms,normalizedRms,rollDegrees,anchorCount:anchors.length,reliable,warning};
}
