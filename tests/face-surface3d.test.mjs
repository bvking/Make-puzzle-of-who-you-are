import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFaceSurface3D,MAX_SURFACE_ANGLE} from '../Taquin deux visages interpolés/face-surface3d.mjs';
import {contourStrip,MOUTH_UPPER,MOUTH_LOWER,EYE_UPPER,EYE_LOWER} from '../Taquin deux visages interpolés/full-face-morph.mjs';

// Existing public portraits only. No private scan is included in the suite.
const fixture=JSON.parse(readFileSync(new URL('../Taquin deux visages interpolés/qa/portrait-landmarks.json',import.meta.url),'utf8'));
const a=fixture['visage_homme.png'],b=fixture['visage_femme.png'];
const triangles=[[10,338,297],[50,101,205],[116,117,118],[9,107,336],[123,116,117],[1,98,327],
 ...contourStrip(MOUTH_UPPER,MOUTH_LOWER),...EYE_UPPER.flatMap((upper,i)=>contourStrip(upper,EYE_LOWER[i]))];
const close=(x,y,epsilon=2e-6)=>assert.ok(Math.abs(x-y)<epsilon,`${x} != ${y}`);
const eyeCenter=points=>[33,133,362,263].reduce((center,id)=>({x:center.x+points[id].x/4,y:center.y+points[id].y/4,z:center.z+points[id].z/4}),{x:0,y:0,z:0});

test('estimated 3D surface preserves observed frontal endpoint XY, relative Z and image UVs',()=>{
 const model=createFaceSurface3D(a,b,triangles);
 assert.ok(model);assert.equal(model.metadata.metric,false);
 assert.equal(model.metadata.depthSource,'mediapipe-relative-z');
 assert.equal(model.metadata.projection,'weak-perspective');
 for(const [t,source] of [[0,a],[1,b]]){
  const sample=model.sample(t),center=eyeCenter(source);
  for(let i=0;i<model.landmarkCount;i++){
   close(sample.positions[i*3],2*source[i].x-1);
   close(sample.positions[i*3+1],1-2*source[i].y);
   close(sample.positions[i*3+2],2*(source[i].z-center.z)*model.metadata.depthProjectionScale);
   close(sample.points[i].x,source[i].x);close(sample.points[i].y,source[i].y);
   close(sample.uvA[i*2],a[i].x);close(sample.uvB[i*2+1],b[i].y);
  }
  assert.equal(sample.textureMix,t);
 }
});

test('3D frame interpolates a rigid yaw and common scale without flattening the face',()=>{
 const center=eyeCenter(a),angle=.5,scale=.7,shift={x:.04,y:-.08};
 const rotate=(p,theta,factor)=>{const x=p.x-center.x,y=p.y-center.y,z=p.z-center.z;return {x:factor*(Math.cos(theta)*x+Math.sin(theta)*z),y:factor*y,z:factor*(-Math.sin(theta)*x+Math.cos(theta)*z)}};
 const transformed=a.map(p=>{const q=rotate(p,angle,scale);return {x:center.x+shift.x+q.x,y:center.y+shift.y+q.y,z:center.z+q.z}});
 const model=createFaceSurface3D(a,transformed,triangles,{mouthCavity:false}),middle=model.sample(.5);
 assert.equal(model.metadata.poseInterpolation,'orthonormal-eye-frame-quaternion');
 for(const id of [1,10,33,263,152,234,454]){
  const expected=rotate(a[id],angle/2,Math.sqrt(scale));
  close(middle.points[id].x,center.x+shift.x/2+expected.x);
  close(middle.points[id].y,center.y+shift.y/2+expected.y);
  close(middle.points[id].z,expected.z);
 }
});

test('depth actually changes parallax during inspection and interpolates between identities',()=>{
 const model=createFaceSurface3D(a,b,triangles),front=model.sample(0),turned=model.sample(0,{yaw:.3,pitch:0}),center=eyeCenter(a);
 for(const id of [1,234,454]){
  const expected=2*center.x-1+2*(Math.cos(.3)*(a[id].x-center.x)+Math.sin(.3)*(a[id].z-center.z));
  close(turned.positions[id*3],expected);
  assert.ok(Math.abs(turned.positions[id*3]-front.positions[id*3])>1e-5);
 }
 assert.ok(Math.abs(model.sample(0).points[1].z-model.sample(1).points[1].z)>1e-4);
 const middle=model.sample(.5);assert.ok(Math.abs(middle.points[1].z-front.points[1].z)>1e-5);
 assert.notDeepEqual(middle.normals,front.normals);
});

test('3D morph is reversible, deterministic and does not mutate its sources or later samples',()=>{
 const first=structuredClone(a),second=structuredClone(b),before=[structuredClone(first),structuredClone(second),structuredClone(triangles)];
 const forward=createFaceSurface3D(first,second,triangles),reverse=createFaceSurface3D(second,first,triangles);
 for(const t of [0,.17,.5,.83,1]){
  const x=forward.sample(t,{yaw:.21,pitch:-.1}),y=reverse.sample(1-t,{yaw:.21,pitch:-.1});
  x.positions.forEach((v,i)=>close(v,y.positions[i]));
  x.normals.forEach((v,i)=>close(v,y.normals[i]));
  close(x.mouthCavityDepth,y.mouthCavityDepth);
 }
 const stable=forward.sample(.5),mutated=forward.sample(.5);mutated.positions.fill(999);mutated.indices.fill(0);mutated.uvA.fill(0);mutated.cavity.fill(0);mutated.points[1].x=999;
 assert.deepEqual(forward.sample(.5),stable);
 first[1].z=999;second[1].x=999;assert.deepEqual(forward.sample(.5),stable);
 assert.deepEqual(triangles,before[2]);assert.deepEqual(a,before[0]);assert.deepEqual(b,before[1]);
});

test('all normals remain finite unit vectors and inspection depth stays inside clip range',()=>{
 const model=createFaceSurface3D(a,b,triangles);
 for(const t of [0,.25,.5,.75,1])for(const yaw of [-MAX_SURFACE_ANGLE,0,MAX_SURFACE_ANGLE])for(const pitch of [-MAX_SURFACE_ANGLE,MAX_SURFACE_ANGLE]){
  const frame=model.sample(t,{yaw,pitch});
  assert.equal(frame.positions.length,model.vertexCount*3);assert.equal(frame.normals.length,model.vertexCount*3);
  assert.equal(frame.uvA.length,model.vertexCount*2);assert.equal(frame.mixUV.length,model.vertexCount*2);assert.equal(frame.cavity.length,model.vertexCount);
  assert.ok([...frame.positions,...frame.normals,...frame.mixUV].every(Number.isFinite));
  for(let i=0;i<model.vertexCount;i++){
   close(Math.hypot(...frame.normals.slice(i*3,i*3+3)),1);assert.ok(Math.abs(frame.positions[i*3+2])<1);
  }
 }
 const front=model.sample(0);assert.ok(front.normals[10*3+2]<0,'front-facing skin normal points toward the camera');
});

test('mouth recess has a bounded explicit heuristic depth and vanishes for a closed opening',()=>{
 const closed=structuredClone(a),mid={x:(a[13].x+a[14].x)/2,y:(a[13].y+a[14].y)/2,z:(a[13].z+a[14].z)/2};closed[13]={...mid};closed[14]={...mid};
 const open=structuredClone(closed);open[13].y-=.025;open[14].y+=.025;
 const model=createFaceSurface3D(closed,open,triangles);
 assert.equal(model.hasCavity,true);assert.equal(model.metadata.mouthCavity,'bounded-aperture-heuristic');
 assert.equal(model.sample(0).mouthCavityDepth,0);assert.ok(model.sample(1).mouthCavityDepth>0);
 assert.ok(model.sample(1).mouthCavityDepth<Math.hypot(open[78].x-open[308].x,open[78].y-open[308].y)*.3+1e-7);
 assert.ok(model.vertexCount>model.landmarkCount);assert.equal(model.sample(.5).cavity.at(-1),1);
 assert.equal(createFaceSurface3D(a,b,triangles,{mouthCavity:false}).vertexCount,478);
});

test('missing depth, planar inputs, unusable frames and malformed topology fail closed',()=>{
 const absent=structuredClone(a);delete absent[10].z;
 const nan=structuredClone(a);nan[1].z=NaN;
 const flat=a.map(p=>({...p,z:0}));
 const collapsed=structuredClone(a);for(const id of [33,133,362,263])collapsed[id]={...a[33]};
 const forehead=structuredClone(a);forehead[10]=eyeCenter(a);
 for(const source of [absent,nan,flat,collapsed,forehead,a.slice(0,400)])assert.equal(createFaceSurface3D(source,b,triangles),null);
 for(const mesh of [[],[[1,1,2]],[[1,2,478]],[[1,2,NaN]],[[1,2]]])assert.equal(createFaceSurface3D(a,b,mesh),null);
 assert.equal(createFaceSurface3D(a,b,triangles,{faceOval:[999]}),null);
 const model=createFaceSurface3D(a,b,triangles);assert.equal(model.sample(NaN),null);assert.equal(model.sample(.5,{yaw:Infinity}),null);
 assert.equal(model.sample(-1).textureMix,0);assert.equal(model.sample(2).textureMix,1);
 assert.equal(model.sample(.5,{yaw:2,pitch:-2}).yaw,MAX_SURFACE_ANGLE);assert.equal(model.sample(.5,{yaw:2,pitch:-2}).pitch,-MAX_SURFACE_ANGLE);
});
