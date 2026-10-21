import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createScanArchive,readScanArchive} from '../Taquin deux visages interpolés/scan-archive.mjs';

const PAGE=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const moduleSource=readFileSync(new URL('../Taquin deux visages interpolés/scan-archive.mjs',import.meta.url),'utf8');
const headRing=Array.from({length:36},(_,i)=>({x:300+120*Math.cos(2*Math.PI*i/36),y:340+160*Math.sin(2*Math.PI*i/36)}));
const face=(n)=>({
 photoBlob:new Blob([new Uint8Array([255,216,255,224,n,0,255,217])],{type:'image/jpeg'}),
 landmarks:Array.from({length:478},(_,i)=>({x:.3+i*.0001,y:.4+n*.01,z:-.01})),
 headRing,
 pose:{yaw:n*.02,pitch:0,roll:0,scale:1},
 quality:{score:80},photometry:{median:.5,usable:true},sharpness:17
});

test('Private ZIP round-trip preserves both source JPEGs and exact landmarks',async()=>{
 const inputs=[face(0),face(1)],zip=await createScanArchive(inputs);
 assert.equal(zip.type,'application/zip');
 assert.ok(zip.size>1000);
 const result=await readScanArchive(zip);
 assert.equal(result.faces.length,2);
 for(let i=0;i<2;i++){
  assert.deepEqual(result.faces[i].landmarks,inputs[i].landmarks);
  assert.deepEqual(result.faces[i].headRing,inputs[i].headRing);
  assert.deepEqual(result.faces[i].pose,inputs[i].pose);
  assert.deepEqual(result.faces[i].quality,inputs[i].quality);
  assert.deepEqual(new Uint8Array(await result.faces[i].photoBlob.arrayBuffer()),
   new Uint8Array(await inputs[i].photoBlob.arrayBuffer()));
 }
});

test('ZIP is not a server upload and contains the expected names',async()=>{
 const zip=await createScanArchive([face(0),face(1)]);
 const data=new Uint8Array(await zip.arrayBuffer());
 const text=new TextDecoder().decode(data);
 for(const name of ['scan.json','visage-A.jpg','visage-B.jpg'])assert.ok(text.includes(name));
 assert.doesNotMatch(moduleSource,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
 assert.match(PAGE,/URL\.createObjectURL\(archive\)/);
 assert.match(PAGE,/id="importScanArchive"/);
 assert.match(PAGE,/id="exportScanArchive"/);
 assert.match(PAGE,/readScanArchive\(file\)/);
 assert.match(PAGE,/state\.sessions=\[\[candidates\[0\]\],\[candidates\[1\]\]\]/);
 assert.match(PAGE,/prepareWhitePortrait\(originalPhotos\[index\],marks\[index\]\)/);
 assert.doesNotMatch(PAGE,/hasSavedRings\?/);
});

test('An invalid or incomplete face is refused before saving',async()=>{
 const corrupted=face(0);corrupted.landmarks[14]={x:NaN,y:.2};
 await assert.rejects(createScanArchive([corrupted,face(1)]),/Repères/);
 await assert.rejects(createScanArchive([face(0)]),/Deux scans/);
});

test('ZIP entry data corruption is detected through CRC',async()=>{
 const zipped=await createScanArchive([face(0),face(1)]);
 const damaged=new Uint8Array(await zipped.arrayBuffer());
 const signature=[255,216,255,224,0,0,255,217];
 let at=-1;
 for(let i=0;i<damaged.length-signature.length;i++){
  if(signature.every((v,j)=>damaged[i+j]===v)){at=i;break}
 }
 assert.ok(at>=0);
 damaged[at+4]^=3;
 await assert.rejects(readScanArchive(new Blob([damaged],{type:'application/zip'})),/CRC/);
});

test('Ordinary documents and excessive-sized files are refused as archives',async()=>{
 await assert.rejects(readScanArchive(new Blob(['hi'],{type:'application/zip'})),/ZIP/);
 await assert.rejects(readScanArchive(new Blob([new Uint8Array(12*1024*1024+1)])),/ZIP/);
});

test('The app never claims the original camera file is preserved',()=>{
 assert.match(PAGE,/photos originales pleine résolution ne sont pas conservées/);
 assert.match(PAGE,/Scans restaurés depuis le ZIP privé/);
});

test('export after matting preserves candidate JPEG bytes or encodes the untouched originals, never the white render sources',async()=>{
 const start=PAGE.indexOf('async function exportCurrentScans(){'),end=PAGE.indexOf('async function restoreSavedScans(',start);
 const source=PAGE.slice(start,end);
 for(const keepCandidate of [true,false]){
  const inputs=[face(0),face(1)],originals=[{name:'original A'},{name:'original B'}],prepared=[{name:'white A'},{name:'white B'}];
  const state={photos:prepared,originalPhotos:originals,marks:inputs.map(input=>input.landmarks),headRings:inputs.map(input=>input.headRing),faceOval:[],
   selectedPair:keepCandidate?{first:{blob:inputs[0].photoBlob},second:{blob:inputs[1].photoBlob}}:null};
  const encoded=[],feedback={},button={},link={click(){},remove(){}};let exported;
  const dependencies={state,$:id=>id==='archiveStatus'?feedback:button,canMeshMorph:()=>true,
   canvasToBlob:async photo=>{const index=originals.indexOf(photo);assert.ok(index>=0,'render sources must not be encoded for private restoration');encoded.push(photo);return inputs[index].photoBlob},
   derivePose:()=>({yaw:0,pitch:0,roll:0,scale:1}),createScanArchive:async faces=>{exported=await createScanArchive(faces);return exported},
   URL:{createObjectURL:()=> 'blob:local-private-archive',revokeObjectURL(){}},document:{createElement:()=>link,body:{appendChild(){}}},setTimeout(){}};
  await new Function(...Object.keys(dependencies),source+';return exportCurrentScans')(...Object.values(dependencies))();
  const restored=await readScanArchive(exported);
  for(let index=0;index<2;index++)assert.deepEqual(new Uint8Array(await restored.faces[index].photoBlob.arrayBuffer()),new Uint8Array(await inputs[index].photoBlob.arrayBuffer()));
  assert.deepEqual(encoded,keepCandidate?[]:originals);assert.equal(button.disabled,false);
  assert.match(feedback.textContent,/Archive créée/);
 }
});
