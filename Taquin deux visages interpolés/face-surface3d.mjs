// An open facial surface from MediaPipe's relative XYZ estimates. This is not
// a metric head reconstruction: ears, hair, the back of the head and unseen
// textures are absent. No source image or landmark is retained outside memory.
import {MOUTH_UPPER,MOUTH_LOWER} from './full-face-morph.mjs';

export const MAX_SURFACE_ANGLE=25*Math.PI/180;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const length=a=>Math.hypot(a.x,a.y,a.z);
const unit=a=>{const n=length(a);return Number.isFinite(n)&&n>1e-10?mul(a,1/n):null};
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

function quaternion(axes){
 const [x,y,z]=axes,m00=x.x,m01=y.x,m02=z.x,m10=x.y,m11=y.y,m12=z.y,m20=x.z,m21=y.z,m22=z.z;
 let q,s;const trace=m00+m11+m22;
 if(trace>0){s=2*Math.sqrt(trace+1);q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4]}
 else if(m00>m11&&m00>m22){s=2*Math.sqrt(1+m00-m11-m22);q=[s/4,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s]}
 else if(m11>m22){s=2*Math.sqrt(1+m11-m00-m22);q=[(m01+m10)/s,s/4,(m12+m21)/s,(m02-m20)/s]}
 else{s=2*Math.sqrt(1+m22-m00-m11);q=[(m02+m20)/s,(m12+m21)/s,s/4,(m10-m01)/s]}
 const n=Math.hypot(...q);return q.map(v=>v/n);
}
function slerp(a,b,t){
 let cosine=a.reduce((s,v,i)=>s+v*b[i],0),end=b;
 if(cosine<0){end=b.map(v=>-v);cosine=-cosine}
 if(cosine>.9995){const q=a.map((v,i)=>v+(end[i]-v)*t),n=Math.hypot(...q);return q.map(v=>v/n)}
 const angle=Math.acos(clamp(cosine,-1,1)),denominator=Math.sin(angle);
 return a.map((v,i)=>(v*Math.sin((1-t)*angle)+end[i]*Math.sin(t*angle))/denominator);
}
function rotate(p,q){
 const u={x:q[0],y:q[1],z:q[2]},uv=cross(u,p),uuv=cross(u,uv);
 return add(p,add(mul(uv,2*q[3]),mul(uuv,2)));
}
function frame(points){
 const left=mix(points[33],points[133],.5),right=mix(points[362],points[263],.5),center=mix(left,right,.5);
 const eyeAxis=sub(right,left),scale=length(eyeAxis),x=unit(eyeAxis);
 if(!x||scale<1e-5)return null;
 // The forehead supplies the second axis. Orthogonalization preserves a
 // proper rotation, rather than interpolating a skewed or shrinking matrix.
 const down=sub(center,points[10]),y=unit(sub(down,mul(x,dot(down,x))));
 if(!y)return null;
 const z=unit(cross(x,y));if(!z)return null;
 const axes=[x,y,z],q=quaternion(axes);
 return {center,scale,axes,q};
}
function canonical(points,f){return points.map(p=>{const v=mul(sub(p,f.center),1/f.scale);return {x:dot(v,f.axes[0]),y:dot(v,f.axes[1]),z:dot(v,f.axes[2])}})}
const place=(p,f)=>add({x:f.center.x,y:f.center.y,z:0},mul(rotate(p,f.q),f.scale));
function inspection(point,yaw,pitch){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 // Camera coordinates are x-right, y-up, z-away; a smaller z wins DEPTH_TEST.
 const x=point.x,y=-point.y,z=point.z,u=cy*x+sy*z,v=-sy*x+cy*z;
 return {x:u,y:cp*y-sp*v,z:sp*y+cp*v};
}
const mouthBoundary=[...MOUTH_UPPER,...MOUTH_LOWER.slice(1,-1).reverse()];
function mouthInterior(points){
 const center=mouthBoundary.reduce((p,id)=>add(p,mul(points[id],1/mouthBoundary.length)),{x:0,y:0,z:0});
 const width=Math.hypot(points[78].x-points[308].x,points[78].y-points[308].y);
 const opening=Math.hypot(points[13].x-points[14].x,points[13].y-points[14].y);
 const depth=Math.min(width*.3,Math.max(0,opening-width*.025)*.45);
 // Only the added recess is heuristic. The observed lip boundary is exact.
 const inner=mouthBoundary.map(id=>{const p=mix(center,points[id],.78);return {...p,z:p.z+depth}});
 return {points:[...inner,{...center,z:center.z+depth}],depth};
}
function uvInterior(points){const {points:inner}=mouthInterior(points);return inner.map(p=>({x:p.x,y:p.y}))}

export function createFaceSurface3D(first,second,triangles,{faceOval=[],size=768,mouthCavity=true}={}){
 if(!Array.isArray(first)||!Array.isArray(second)||first.length<468||second.length<468||
  !Array.isArray(triangles)||!triangles.length||!Array.isArray(faceOval)||!Number.isFinite(size)||size<=0||typeof mouthCavity!=='boolean')return null;
 const count=Math.min(first.length,second.length,478),a=first.slice(0,count).map(p=>p&&({x:p.x,y:p.y,z:p.z})),b=second.slice(0,count).map(p=>p&&({x:p.x,y:p.y,z:p.z}));
 if(![...a,...b].every(p=>finite(p)&&Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))<100)||
  !faceOval.every(id=>Number.isInteger(id)&&id>=0&&id<count))return null;
 const fa=frame(a),fb=frame(b);if(!fa||!fb)return null;
 const shapeA=canonical(a,fa),shapeB=canonical(b,fb);
 if([...shapeA,...shapeB].some(p=>!finite(p)||length(p)>1e4))return null;
 // Missing z is rejected above; an entirely planar input is also not promoted
 // to a 3D face by silently inventing depth.
 if([a,b].some(points=>Math.max(...points.map(p=>p.z))-Math.min(...points.map(p=>p.z))<1e-7))return null;
 const seen=new Set(),skin=[];
 for(const ids of triangles){
  if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||!ids.every(id=>Number.isInteger(id)&&id>=0&&id<count))return null;
  const key=ids.slice().sort((x,y)=>x-y).join('-');if(seen.has(key))continue;seen.add(key);skin.push(ids.slice());
 }
 const boundarySet=new Set(mouthBoundary),mouthTriangles=skin.filter(ids=>ids.every(id=>boundarySet.has(id)));
 const used=new Set(mouthTriangles.flat()),hasCavity=mouthCavity&&mouthBoundary.every(id=>used.has(id));
 const extra=hasCavity?mouthBoundary.length+1:0,vertexCount=count+extra;
 const inputUV=points=>{const all=hasCavity?[...points,...uvInterior(points)]:points;return Float32Array.from(all.flatMap(p=>[p.x,p.y]))};
 const uvA=inputUV(a),uvB=inputUV(b),cavity=new Float32Array(vertexCount);if(hasCavity)cavity.fill(1,count);
 const rawTriangles=hasCavity?skin.filter(ids=>!ids.every(id=>boundarySet.has(id))):skin;
 if(hasCavity)for(let i=0;i<mouthBoundary.length;i++){
  const next=(i+1)%mouthBoundary.length,inner=count+i,innerNext=count+next;
  rawTriangles.push([mouthBoundary[i],mouthBoundary[next],inner],[mouthBoundary[next],innerNext,inner],[inner,innerNext,vertexCount-1]);
 }
 const centerFrame=t=>({center:mix(fa.center,fb.center,t),scale:Math.exp((1-t)*Math.log(fa.scale)+t*Math.log(fb.scale)),q:slerp(fa.q,fb.q,t)});
 const targetAt=t=>{
  const f=centerFrame(t),shape=shapeA.map((p,i)=>mix(p,shapeB[i],t));
  const mouth=hasCavity?mouthInterior(shape):{points:[],depth:0};
  const points=shape.concat(mouth.points).map(p=>place(p,f));
  // Keep original observed coordinates at endpoints, including tiny details.
  if(t===0||t===1){const source=t===0?a:b,origin=t===0?fa.center:fb.center;for(let i=0;i<count;i++)points[i]={x:source[i].x,y:source[i].y,z:source[i].z-origin.z}}
  return {points,depth:mouth.depth*f.scale};
 };
 const start=targetAt(0).points,end=targetAt(1).points;
 const area=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 // Source triangle winding is not assumed. A common orientation is chosen
 // once, so inspection can reveal genuine back-facing parts of the surface.
 const oriented=rawTriangles.map(ids=>{const aa=area(...ids.map(id=>start[id])),bb=area(...ids.map(id=>end[id]));return (Math.abs(aa)>=Math.abs(bb)?aa:bb)<0?[ids[0],ids[2],ids[1]]:ids});
 const indices=Uint16Array.from(oriented.flat());
 const usable=oriented.some(ids=>length(cross(sub(start[ids[1]],start[ids[0]]),sub(start[ids[2]],start[ids[0]])))>1e-12);
 if(!usable)return null;
 // Orthographic near/far projection has its own scale. XY/parallax and normals
 // retain the estimated geometry; distant points do not clip solely because of
 // a narrow depth range chosen for ordinary front-facing photos.
 const radius=Math.max(...shapeA.concat(shapeB).map(length)) * Math.max(fa.scale,fb.scale)*1.4;
 const depthProjectionScale=Math.min(1,.95/Math.max(1e-9,2*radius));
 const metadata=Object.freeze({kind:'estimated-open-face-surface',metric:false,depthSource:'mediapipe-relative-z',projection:'weak-perspective',
  poseInterpolation:'orthonormal-eye-frame-quaternion',mouthCavity:hasCavity?'bounded-aperture-heuristic':'none',
  limitation:'Surface faciale ouverte estimée ; aucun crâne, cheveux ni texture cachée reconstruits.',depthProjectionScale});
 return {metadata,vertexCount,landmarkCount:count,size,hasCavity,
  sample(progress,{yaw=0,pitch=0}={}){
   if(!Number.isFinite(progress)||!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
   const t=clamp(progress,0,1),turn=clamp(yaw,-MAX_SURFACE_ANGLE,MAX_SURFACE_ANGLE),tilt=clamp(pitch,-MAX_SURFACE_ANGLE,MAX_SURFACE_ANGLE);
   const {points,depth}=targetAt(t),center=mix(fa.center,fb.center,t),positions=new Float32Array(vertexCount*3),camera=new Float64Array(vertexCount*3),mixUV=new Float32Array(vertexCount*2);
   points.forEach((p,i)=>{
    const v=inspection(sub(p,{x:center.x,y:center.y,z:0}),turn,tilt);
    camera.set([2*v.x,2*v.y,2*v.z],i*3);
    positions.set([2*center.x-1+2*v.x,1-2*center.y+2*v.y,2*v.z*depthProjectionScale],i*3);
    mixUV.set([p.x,p.y],i*2);
   });
   const accumulation=new Float64Array(vertexCount*3);
   for(let n=0;n<indices.length;n+=3){
    const ids=[indices[n],indices[n+1],indices[n+2]],p=ids.map(i=>({x:camera[i*3],y:camera[i*3+1],z:camera[i*3+2]})),normal=cross(sub(p[1],p[0]),sub(p[2],p[0]));
    for(const id of ids){accumulation[id*3]+=normal.x;accumulation[id*3+1]+=normal.y;accumulation[id*3+2]+=normal.z}
   }
   const normals=new Float32Array(vertexCount*3);
   for(let i=0;i<vertexCount;i++){
    const n=unit({x:accumulation[i*3],y:accumulation[i*3+1],z:accumulation[i*3+2]})||{x:0,y:0,z:-1};normals.set([n.x,n.y,n.z],i*3);
   }
   // Buffers belong to this sample: callers cannot mutate later geometry by
   // editing a previous frame or the constructor's source arrays.
   return {positions,normals,uvA:uvA.slice(),uvB:uvB.slice(),indices:indices.slice(),mixUV,cavity:cavity.slice(),textureMix:t,
    points:points.slice(0,count).map(p=>({...p})),mouthCavityDepth:depth,yaw:turn,pitch:tilt,metadata};
  }
 };
}
