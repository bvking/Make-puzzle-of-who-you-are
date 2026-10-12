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
