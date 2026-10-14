// Localized morph zones for imperfect handheld captures.
// Photographs stay client-side: only numeric landmarks are passed to this module.
// Upper-face protection is manual; no automatic glasses recognition is claimed.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const required=[33,133,362,263,61,291,13,14,1,152];
const valid=points=>Array.isArray(points)&&required.every(i=>finite(points[i]));
const center=(points,ids)=>({
 x:ids.reduce((sum,i)=>sum+points[i].x,0)/ids.length,
 y:ids.reduce((sum,i)=>sum+points[i].y,0)/ids.length
});
export function localMaskFeatures(points,protectGlasses=true,referencePoints=null,alignedPoints=null){
 if(!valid(points))return null;
 // Use A and the aligned B together: a mask restricted to the current
 // interpolated lips alone can reveal a stationary A-mouth around its edges.
 const samples=[points,referencePoints,alignedPoints].filter(valid);
 const mouth=center(points,[61,291,13,14]),chin=points[152],nose=points[1];
 const span=Math.max(35,...samples.map(p=>distance(p[61],p[291])));
 const gap=Math.max(10,...samples.map(p=>distance(p[13],p[14])));
 const outline=samples.flatMap(p=>[61,291,13,14,17,0].filter(i=>finite(p[i])).map(i=>p[i]));
 const extentX=Math.max(...outline.map(p=>Math.abs(p.x-mouth.x)));
 const extentY=Math.max(...outline.map(p=>Math.abs(p.y-mouth.y)));
 const jawSpan=Math.max(12,...samples.map(p=>distance(center(p,[61,291,13,14]),p[152])));
 const rx=Math.max(span*.92,extentX*1.24);
 const ry=Math.max(span*.56,gap*1.18,extentY*1.23);
 const fields=[
  {name:'mouth',x:mouth.x,y:mouth.y,rx,ry,opacity:.98},
  // Soft jaw region follows mouth opening while fading before hair/neck.
  // Do not extend full-opacity texture B to the outer face outline.
  {name:'lowerFace',x:mouth.x,y:mouth.y+.48*(chin.y-mouth.y),
   rx:Math.max(span*.97,rx*.92),ry:Math.max(span*.54,jawSpan*.71),opacity:.62},
  {name:'nose',x:nose.x,y:nose.y,rx:span*.40,ry:span*.42,opacity:protectGlasses?.26:.40}
 ];
 if(!protectGlasses){
  for(const [name,ids] of [['leftEye',[33,133]],['rightEye',[362,263]]]){
   const eye=center(points,ids),width=Math.max(25,distance(points[ids[0]],points[ids[1]]));
   fields.push({name,x:eye.x,y:eye.y,rx:width*.78,ry:width*.63,opacity:.64});
  }
 }
 return fields;
}

// Morph geometry and appearance need not use the same interpolation amount.
// With very different mouth openings, a literal 50/50 texture mix produces
// double lips and phantom teeth even when the triangles move correctly.
// A gentle monotone bias favors the *visible* mouth interior after it opens,
// while preserving exact geometry percentages and both endpoints.
export function mouthOpeningRatio(points){
 if(!valid(points))return null;
 const width=distance(points[61],points[291]),height=distance(points[13],points[14]);
 return width>1e-6?height/width:null;
}
const clamp01=x=>Math.max(0,Math.min(1,x));
const smooth01=x=>{const t=clamp01(x);return t*t*(3-2*t)};
function preferOpenedTexture(t,strength){
 // The early 0-10% transition remains largely unchanged. Derivative stays
 // non-negative for strength <= .80 and the exact 0/1 endpoints are retained.
 const bias=smooth01((t-.10)/.40);
 return t+strength*t*(1-t)*bias;
}
export function localAppearanceMix(progress,referencePoints,alignedPoints){
 const t=clamp01(Number(progress));
 if(!Number.isFinite(t))return 0;
 if(t===0||t===1)return t;
 const openA=mouthOpeningRatio(referencePoints),openB=mouthOpeningRatio(alignedPoints);
 if(openA===null||openB===null)return t;
 const gap=openB-openA,weight=.8*smooth01((Math.abs(gap)-.08)/.25);
 if(weight<1e-6)return t;
 return clamp01(gap>0?preferOpenedTexture(t,weight):
  1-preferOpenedTexture(1-t,weight));
}

// The actual outer lip contour is a better hard-preservation region than a
// broad oval: preserve the entire moving aperture without mixing it with
// the unwarped lips of A underneath. Only numeric geometry is handled here.
export const OUTER_LIP_CONTOUR=[61,40,37,0,267,270,291,321,314,17,84,91];
export function outerLipEnvelope(points,referencePoints=null,alignedPoints=null){
 if(!valid(points))return null;
 const samples=[points,referencePoints,alignedPoints].filter(valid);
 const all=samples.flatMap(p=>OUTER_LIP_CONTOUR.map(id=>p[id]).filter(finite));
 if(all.length<OUTER_LIP_CONTOUR.length)return null;
 // Union of A, B and the intermediate pose, expanded to avoid exposed
 // original-image lip pixels at the mask boundary.
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
 const minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
 const gap=Math.max(8,(maxX-minX)*.065);
 return {x:(minX+maxX)/2,y:(minY+maxY)/2,
  rx:Math.max(6,(maxX-minX)/2+gap),ry:Math.max(6,(maxY-minY)/2+gap*.80)};
}
