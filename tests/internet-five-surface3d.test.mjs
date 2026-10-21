import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createFullFaceMorph,assessSampledMorphPath} from '../Taquin deux visages interpolés/full-face-morph.mjs';
import {createFaceSurface3D} from '../Taquin deux visages interpolés/face-surface3d.mjs';

// Only the five attributed public internet photographs are used here. These
// relative XYZ were actually detected by the browser's photo-import pipeline.
// Finite/reversible geometry is not a visual-quality or application-acceptance
// certificate: real compatibility and WebGL evidence remain in browser QA.
const base=new URL('../Taquin deux visages interpolés/qa/internet-five/',import.meta.url);
const readJson=name=>JSON.parse(readFileSync(new URL(name,base),'utf8'));
const manifest=readJson('manifest.json'),fixture=readJson('detected-landmarks.json'),topology=readJson('mediapipe-topology.json');
const pixels=points=>points.map(({x,y})=>({x:x*768,y:y*768}));
const close=(actual,expected,tolerance=3e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const finiteBuffer=(buffer,label)=>{assert.ok(buffer instanceof Float32Array,label);assert.ok(buffer.every(Number.isFinite),label+' must remain finite')};

// Parse the file's JPEG SOF dimensions independently of the preprocessing code.
// The fixture also pins its bytes, so an image replacement cannot silently
// continue using coordinates detected from the previous photograph.
function jpegDimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG signature');let offset=2;
 while(offset+3<bytes.length){
  assert.equal(bytes[offset++],0xff,'JPEG marker');while(bytes[offset]===0xff)offset++;
  const marker=bytes[offset++];if(marker===0xd9||marker===0xda)break;if(marker===1||marker>=0xd0&&marker<=0xd7)continue;
  const length=bytes.readUInt16BE(offset);assert.ok(length>=2&&offset+length<=bytes.length,'JPEG segment bounds');
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};
  offset+=length;
 }
 throw Error('JPEG frame dimensions missing');
}

test('five public landmark fixtures retain exact photograph hashes, dimensions and attribution',()=>{
 assert.equal(manifest.scope,'public-internet-five');assert.equal(fixture.scope,manifest.scope);
 assert.equal(fixture.coordinateSystem,'canonical-square-768-normalized');assert.equal(fixture.detection,'application-import-cpu-image');
 assert.equal(fixture.provenance.canonicalImageSize,768);assert.equal(fixture.provenance.analysisImageSize,512);
 assert.equal(fixture.portraits.length,5);assert.equal(manifest.portraits.length,5);
 assert.equal(new Set(fixture.portraits.map(p=>p.id)).size,5);
 for(const [index,portrait] of fixture.portraits.entries()){
  const source=manifest.portraits[index];
  for(const field of ['id','file','sourceUrl','author','license','licenseUrl'])assert.equal(portrait[field],source[field],portrait.id+' '+field);
  assert.match(portrait.file,/^p0[1-5]\.jpg$/);const bytes=readFileSync(new URL(portrait.file,base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),portrait.sourceImageSha256,portrait.id+' source pixels changed; re-detect the public fixture');
  assert.deepEqual(jpegDimensions(bytes),{width:portrait.sourceImageWidth,height:portrait.sourceImageHeight});
  assert.equal(portrait.landmarks.length,478);
  for(const point of portrait.landmarks){assert.deepEqual(Object.keys(point).sort(),['x','y','z']);assert.ok(Object.values(point).every(Number.isFinite))}
 }
});

test('offline 3D regressions use the application MediaPipe version and complete production skin topology',()=>{
 const html=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
 assert.equal(html.match(/const MEDIAPIPE_MODULE="([^"]+)"/)?.[1],topology.moduleUrl);
 assert.equal(topology.packageVersion,fixture.provenance.mediapipeVersion);assert.equal(topology.license,'Apache-2.0');
 assert.match(readFileSync(new URL(topology.licenseFile,base),'utf8'),/Apache License\s+Version 2\.0/);
 assert.match(topology.moduleSha256,/^[a-f0-9]{64}$/);assert.equal(topology.triangles.length,852);assert.equal(topology.faceOval.length,36);
 assert.equal(new Set(topology.faceOval).size,36);const seen=new Set();
 for(const ids of topology.triangles){assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.ok(ids.every(id=>Number.isInteger(id)&&id>=0&&id<468));seen.add(ids.slice().sort((a,b)=>a-b).join('-'))}
 assert.equal(seen.size,852);assert.ok(topology.faceOval.every(id=>Number.isInteger(id)&&id>=0&&id<468));
});

for(let ia=0;ia<5;ia++)for(let ib=ia+1;ib<5;ib++){
 const first=fixture.portraits[ia],second=fixture.portraits[ib];
 test(`public 3D geometry remains finite, exact at endpoints and reversible: ${first.id} / ${second.id}`,t=>{
  const a=first.landmarks,b=second.landmarks,before=JSON.stringify([a,b]);
  // Use exactly the production skin plus its selected semantic eye/mouth
  // topology. Construction for a rejected pair remains diagnostic only.
  const full=createFullFaceMorph(pixels(a),pixels(b),topology.triangles,topology.faceOval);
  const reverseFull=createFullFaceMorph(pixels(b),pixels(a),topology.triangles,topology.faceOval);
  assert.ok(full&&reverseFull);const triangles=full.sample(.5).triangles;
  const forward=createFaceSurface3D(a,b,triangles,{faceOval:topology.faceOval}),reverse=createFaceSurface3D(b,a,reverseFull.sample(.5).triangles,{faceOval:topology.faceOval});
  assert.ok(forward&&reverse);assert.equal(forward.metadata.metric,false);assert.equal(forward.metadata.depthSource,'mediapipe-relative-z');
  const quality=assessSampledMorphPath(pixels(a),pixels(b),topology.triangles,amount=>pixels(forward.sample(amount).points));
  assert.equal(quality.valid,true);assert.equal(quality.samples,33);assert.equal(quality.triangles,852);
  for(const key of ['flipArea','collapseArea'])assert.ok(Number.isFinite(quality[key])&&quality[key]>=0&&quality[key]<=1);
  t.diagnostic(`Sampled projected geometry only: flipArea=${quality.flipArea}, collapseArea=${quality.collapseArea}; this does not assert application acceptance.`);
  for(let step=0;step<=32;step++)for(const inspection of [{yaw:0,pitch:0},{yaw:20*Math.PI/180,pitch:10*Math.PI/180}]){
   const amount=step/32,sample=forward.sample(amount,inspection),opposite=reverse.sample(1-amount,inspection);
   for(const key of ['positions','normals','uvA','uvB','mixUV','cavity'])finiteBuffer(sample[key],key);
   assert.equal(sample.positions.length,forward.vertexCount*3);assert.equal(sample.normals.length,sample.positions.length);
   assert.equal(sample.points.length,478);assert.ok(sample.points.every(point=>Object.values(point).every(Number.isFinite)));
   assert.ok(sample.indices instanceof Uint16Array);assert.ok(sample.indices.length>852*3);assert.ok(sample.indices.every(id=>id<forward.vertexCount));
   close(sample.textureMix,amount);close(sample.textureMix+opposite.textureMix,1);close(sample.mouthCavityDepth,opposite.mouthCavityDepth);
   let minimumDepth=Infinity,maximumDepth=-Infinity;
   for(let id=0;id<forward.vertexCount;id++){
    close(Math.hypot(...sample.normals.subarray(id*3,id*3+3)),1);
    const depth=sample.positions[id*3+2];assert.ok(Math.abs(depth)<1);minimumDepth=Math.min(minimumDepth,depth);maximumDepth=Math.max(maximumDepth,depth);
   }
   assert.ok(maximumDepth-minimumDepth>1e-5,'Estimated surface must retain nonzero relief');
   for(let index=0;index<sample.positions.length;index++){close(sample.positions[index],opposite.positions[index]);close(sample.normals[index],opposite.normals[index])}
   if(step===0||step===32){const source=step===0?a:b;for(let id=0;id<478;id++){assert.equal(sample.points[id].x,source[id].x);assert.equal(sample.points[id].y,source[id].y)}}
   for(let id=0;id<478;id++){close(sample.uvA[id*2],a[id].x);close(sample.uvA[id*2+1],a[id].y);close(sample.uvB[id*2],b[id].x);close(sample.uvB[id*2+1],b[id].y)}
  }
  assert.equal(JSON.stringify([a,b]),before,'Inputs must remain unchanged');
 });
}
