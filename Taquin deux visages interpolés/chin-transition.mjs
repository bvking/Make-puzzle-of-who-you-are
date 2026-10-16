// Experimental geometry-only lower-face transition. No image or biometric data stored.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=x=>Math.max(0,Math.min(1,x));
const safe=p=>Array.isArray(p)&&[13,14,17,61,291,152].every(i=>finite(p[i]));
export function chinTransition(points,source=null,target=null){
 if(!safe(points))return null;
 const samples=[points,source,target].filter(safe);
 const mouthWidth=Math.max(...samples.map(p=>dist(p[61],p[291])));
 if(mouthWidth<1e-4)return null;
 const opening=Math.max(...samples.map(p=>dist(p[13],p[14])/Math.max(1,dist(p[61],p[291]))));
 const currentOpening=dist(points[13],points[14])/Math.max(1,dist(points[61],points[291]));
 // Local bridge strength follows the CURRENT geometry, not the maximum
 // opening across A and B: closed-mouth frames should not receive an
 // oversized jaw patch merely because the other photograph is open.
 const openness=clamp((currentOpening-.10)/.45);
 const maximumOpenness=clamp((opening-.10)/.45);
 const lower=points[17],chin=points[152];
 const x=lower.x+(chin.x-lower.x)*.27;
 const y=lower.y+(chin.y-lower.y)*(.30+.12*openness);
 const travel=Math.max(...samples.map(p=>dist(p[17],p[152])));
 if(travel<1e-4)return null;
 return {name:'chinBridge',x,y,rx:mouthWidth*(.43+.05*openness),
  ry:Math.max(10,Math.min(travel*.70,mouthWidth*(.27+.14*openness))),
  opacity:.30+.14*openness,
  maxOpening:maximumOpenness};
}
