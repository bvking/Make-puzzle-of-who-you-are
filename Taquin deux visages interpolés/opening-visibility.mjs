// Visibility is a local texture decision, not a new shape or synthesized view.
// Work in the same canonical pixel coordinates as the shared morph geometry.
import {MOUTH_UPPER,MOUTH_LOWER,EYE_UPPER,EYE_LOWER} from './full-face-morph.mjs';

const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t)};
const definitions=[
 {id:'mouth',upper:MOUTH_UPPER,lower:MOUTH_LOWER,open:.11},
 ...EYE_UPPER.map((upper,i)=>({id:i?'eye-right':'eye-left',upper,lower:EYE_LOWER[i],open:.10}))
];

function measure(contour){
 if(!Array.isArray(contour)||contour.length<4||!contour.every(finite))return null;
 const first=contour[0],last=contour[contour.length/2];
 const width=Math.hypot(last.x-first.x,last.y-first.y);
 if(!Number.isFinite(width)||width<=1e-8)return null;
 // Subtract a local origin to avoid cancellation after large translations.
 let twiceArea=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let i=0;i<contour.length;i++){
  const p=contour[i],q=contour[(i+1)%contour.length];
  twiceArea+=(p.x-first.x)*(q.y-first.y)-(p.y-first.y)*(q.x-first.x);
  minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
  maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
 }
 const area=Math.abs(twiceArea)/2,aperture=area/(width*width);
 if(!Number.isFinite(aperture))return null;
 return {width,area,aperture,bounds:{minX,minY,maxX,maxY}};
}

function contourAt(points,definition){
 if(!Array.isArray(points))return null;
 const ids=[...definition.upper,...definition.lower.slice(1,-1).reverse()];
 if(!ids.every(id=>finite(points[id])))return null;
 return ids.map(id=>({x:points[id].x,y:points[id].y}));
}

// A small positive reliability floor gives a continuous A/B coefficient even
// for a completely closed source. There is no hard source switch on opening.
// Thresholds are prototype image-space heuristics, not anatomical estimates.
export function openingTextureMix(progress,apertureA,apertureB,
 {closed=.008,open=.10,minReliability=.025}={}){
 if(![progress,apertureA,apertureB,closed,open,minReliability].every(Number.isFinite)||
  apertureA<0||apertureB<0||closed<0||open<=closed||minReliability<=0||minReliability>1)return null;
 const t=clamp(progress);
 if(t===0||t===1)return t;
 const reliability=aperture=>minReliability+(1-minReliability)*smooth((aperture-closed)/(open-closed));
 const ra=reliability(apertureA),rb=reliability(apertureB);
 if(ra===rb)return t;
 const a=(1-t)*ra,b=t*rb;
 return b/(a+b);
}

// Invalid individual openings are omitted, so one unreliable eye does not
// change the other eye or mouth. Coordinates stay in memory; nothing is saved.
export function createOpeningVisibility(first,second,
 {closed=.008,minReliability=.025,minFeather=.002,maxFeather=.018}={}){
 if(!Array.isArray(first)||!Array.isArray(second)||
  ![closed,minReliability,minFeather,maxFeather].every(Number.isFinite)||
  closed<0||closed>=.10||minReliability<=0||minReliability>1||
  minFeather<=0||maxFeather<minFeather)return null;
 const sources=definitions.flatMap(definition=>{
  const a=contourAt(first,definition),b=contourAt(second,definition);
  const ma=measure(a),mb=measure(b);
  return ma&&mb?[{definition,a,b,ma,mb}]:[];
 });
 if(!sources.length)return null;
 return {
  sample(progress,target=null){
   if(!Number.isFinite(progress)||(target!==null&&!Array.isArray(target)))return null;
   const t=clamp(progress),regions=[];
   for(const {definition,a,b,ma,mb} of sources){
    const contour=target===null?a.map((p,i)=>({x:p.x+(b[i].x-p.x)*t,y:p.y+(b[i].y-p.y)*t})):contourAt(target,definition);
    const current=measure(contour);
    if(!current||current.area===0)continue;
    const textureMix=openingTextureMix(t,ma.aperture,mb.aperture,{closed,open:definition.open,minReliability});
    // Feather stays inside the inner-lip/eyelid boundary. Its positive lower
    // bound makes subpixel openings fade in smoothly instead of switching a
    // whole pixel on; larger cavities retain a fully selected central region.
    const averageHeight=current.area/current.width;
    const feather=Math.min(current.width*maxFeather,Math.max(current.width*minFeather,averageHeight*.32));
    regions.push({id:definition.id,contour,bounds:current.bounds,textureMix,feather,
     apertureA:ma.aperture,apertureB:mb.aperture,targetAperture:current.aperture});
   }
   return {t,regions};
  }
 };
}

// Strictly interior mask: alpha is zero on the contour and everywhere outside.
// The polygon is the observed cavity, excluding lip skin and eyelid surfaces.
export function openingMaskAlpha(region,point){
 if(!finite(point)||!region||!Array.isArray(region.contour)||
  region.contour.length<4||!region.contour.every(finite)||
  !Number.isFinite(region.feather)||region.feather<=0)return 0;
 const contour=region.contour;
 let inside=false,distance=Infinity;
 for(let i=0,j=contour.length-1;i<contour.length;j=i++){
  const a=contour[j],b=contour[i],dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
  const projection=length2?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length2):0;
  distance=Math.min(distance,Math.hypot(point.x-a.x-projection*dx,point.y-a.y-projection*dy));
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside?smooth(distance/region.feather):0;
}

// Reference per-pixel coefficient for both renderers. Iterating only each
// region's bounding box is equivalent for the normal non-overlapping cavities.
// If malformed geometry overlaps regions, use the strongest mask rather than
// adding corrections, keeping every result within the source weights [0,1].
export function openingTextureWeight(sample,point){
 if(!sample||!Number.isFinite(sample.t)||!Array.isArray(sample.regions)||!finite(point))return null;
 let alpha=0,mix=clamp(sample.t);
 for(const region of sample.regions){
  const next=openingMaskAlpha(region,point);
  if(next>alpha&&Number.isFinite(region.textureMix)){alpha=next;mix=clamp(region.textureMix)}
 }
 return clamp(sample.t)+(mix-clamp(sample.t))*alpha;
}
