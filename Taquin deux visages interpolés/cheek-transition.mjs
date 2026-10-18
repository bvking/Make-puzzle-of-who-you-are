// Conservative alpha-only cheek bridges in canonical image pixels.
// No image access, landmark persistence, or changes to the morph mesh.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const eyeIds=[33,133,362,263];
const required=[...eyeIds,61,291,13,14,152];
const valid=p=>Array.isArray(p)&&required.every(id=>finite(p[id]));
const mean=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});

export function cheekTransitions(points,source=null,target=null){
 if(!valid(points))return [];
 const left=mean(points[33],points[133]),right=mean(points[362],points[263]);
 const span=Math.hypot(right.x-left.x,right.y-left.y);
 if(!Number.isFinite(span)||span<1e-4)return [];
 const origin=mean(left,right),ux=(right.x-left.x)/span,uy=(right.y-left.y)/span;
 let vx=-uy,vy=ux;
 if((points[152].x-origin.x)*vx+(points[152].y-origin.y)*vy<0){vx=-vx;vy=-vy}
 const project=p=>({x:(p.x-origin.x)*ux+(p.y-origin.y)*uy,
  y:(p.x-origin.x)*vx+(p.y-origin.y)*vy});
 const a=project(points[61]),b=project(points[291]);
 const corners=[a,b].sort((p,q)=>p.x-q.x),width=corners[1].x-corners[0].x;
 const mouth=mean(project(points[13]),project(points[14])),chin=project(points[152]);
 // Refuse collapsed/inverted proportions and strong residual perspective.
 if(!finite(origin)||!finite(mouth)||!finite(chin)||!Number.isFinite(width)||
  width<span*.15||width>span*1.5||mouth.y<=span*.2||chin.y<=mouth.y+width*.2)return [];
 // All three poses share a protected band. Lower lids are optional; eye
 // corners remain mandatory. Padding also keeps the new alpha below glasses.
 const eyeBottom=Math.max(...[points,source,target].filter(valid).flatMap(p=>
  [...eyeIds,145,374].filter(id=>finite(p[id])).map(id=>project(p[id]).y)));
 const upperLimit=eyeBottom+span*.18;
 const opening=Math.hypot(points[13].x-points[14].x,points[13].y-points[14].y)/width;
 const t=Math.max(0,Math.min(1,(opening-.10)/.45));
 const opacity=.20+.06*t*t*(3-2*t),angle=Math.atan2(uy,ux),fields=[];
 const sides=[234,454].filter(id=>finite(points[id])).map(id=>project(points[id]));
 for(const [index,sign] of [[0,-1],[1,1]]){
  const corner=corners[index];
  const candidates=sides.map(p=>sign*(p.x-corner.x)).filter(room=>room>width*.12);
  if(!candidates.length)continue;
  const room=Math.min(...candidates),offset=Math.min(width*.24,room*.28);
  const x=corner.x+sign*offset,y=corner.y+width*.18;
  const top=Math.max(upperLimit,corner.y-width*.22);
  const bottom=Math.min(chin.y-width*.15,corner.y+width*.72);
  const rx=Math.min(width*.40,room-offset-width*.08),ry=Math.min(width*.40,y-top,bottom-y);
  if(rx<width*.06||ry<width*.06)continue;
  const field={name:index===0?'leftCheek':'rightCheek',
   x:origin.x+x*ux+y*vx,y:origin.y+x*uy+y*vy,rx,ry,angle,opacity};
  if(Object.values(field).filter(value=>typeof value==='number').every(Number.isFinite))fields.push(field);
 }
 return fields;
}
