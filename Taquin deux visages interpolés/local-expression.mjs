// Localized motion zones for imperfect handheld face captures.
// No glasses detection is attempted: upper-face protection is an explicit choice.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function localMaskFeatures(points,protectGlasses=true){
 const needed=[33,133,362,263,61,291,13,14,1,152];
 if(!Array.isArray(points)||needed.some(i=>!finite(points[i])))return null;
 const at=i=>points[i],middle=(...ids)=>({x:ids.reduce((t,i)=>t+at(i).x,0)/ids.length,y:ids.reduce((t,i)=>t+at(i).y,0)/ids.length});
 const mouth=middle(61,291,13,14),chin=at(152),nose=at(1);
 const span=Math.max(35,distance(at(61),at(291))),gap=Math.max(10,distance(at(13),at(14)));
 const features=[
  {name:'mouth',x:mouth.x,y:mouth.y+.10*(chin.y-mouth.y),rx:span*.88,ry:Math.max(span*.58,gap*1.9),opacity:.98},
  {name:'nose',x:nose.x,y:nose.y,rx:span*.40,ry:span*.42,opacity:protectGlasses?.26:.40}
 ];
 if(!protectGlasses){
  for(const [name,ids] of [['leftEye',[33,133]],['rightEye',[362,263]]]){
   const center=middle(...ids),width=Math.max(25,distance(at(ids[0]),at(ids[1])));
   features.push({name,x:center.x,y:center.y,rx:width*.78,ry:width*.63,opacity:.64});
  }
 }
 return features;
}
