import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPortraitMatte,compositePortraitOnWhite} from '../Taquin deux visages interpolés/portrait-matte.mjs';

const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const between=(start,end)=>page.slice(page.indexOf(start),page.indexOf(end,page.indexOf(start)));
const prepareSource=between('async function prepareWhitePortrait(','async function extractHeadRing(');
const applySource=between('async function applyMatchedView(','function readControls(');

function preparationSetup(kind){
 const size=40,landmarks=[{x:.3,y:.3},{x:.7,y:.3},{x:.7,y:.7},{x:.3,y:.7}];
 const input=new Uint8ClampedArray(size*size*4);
 for(let i=0;i<size*size;i++)input.set([20,70,130,255],i*4);
 const photo={getContext:()=>({getImageData:()=>({data:input})})},original=input.slice();
 let output,closed=0;
 const categories=new Uint8Array(size*size);
 for(let y=6;y<29;y++)for(let x=10;x<30;x++)categories[y*size+x]=y<12?1:3;
 const planes=Array.from({length:6},()=>new Float32Array(size*size));
 for(let i=0;i<categories.length;i++)planes[categories[i]][i]=1;
 const result={
  categoryMask:{width:size,height:size,getAsUint8Array:()=>categories},
  close(){closed++;categories.fill(0);planes.forEach(p=>p.fill(0))}
 };
 if(kind==='confidence')result.confidenceMasks=planes.map(data=>({width:size,height:size,getAsFloat32Array:()=>data}));
 const segmenter=kind==='missing'?null:{segment(source){assert.equal(source,photo);if(kind==='throw')throw Error('inference unavailable');return result}};
 const injected=new Function('SIZE','state','headRingBasis','ensureSegmenter','createPortraitMatte','compositePortraitOnWhite','makeCanvas','headRingFromMaskSampler','bilinearMaskValue','console',prepareSource+';return prepareWhitePortrait');
 const prepare=injected(size,{faceOval:[0,1,2,3]},()=>({down:{x:0,y:1}}),async()=>segmenter,createPortraitMatte,compositePortraitOnWhite,
  ()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(input.length)}),putImageData(image){output=image.data}})}),
  (_points,_width,_height,sample)=>({centre:sample(20,20),background:sample(0,0)}),
  (data,width,height,x,y)=>data[Math.max(0,Math.min(height-1,Math.floor(y)))*width+Math.max(0,Math.min(width-1,Math.floor(x)))],{warn(){}});
 return{prepare,photo,landmarks,input,original,get output(){return output},get closed(){return closed}};
}

test('preparation copies multiclass model data before releasing it and whites the real source without mutation',async()=>{
 for(const kind of ['confidence','category']){
  const d=preparationSetup(kind),result=await d.prepare(d.photo,d.landmarks);
  assert.equal(result.method,'head-segmentation');assert.equal(d.closed,1);
  assert.notEqual(result.photo,d.photo);
  assert.deepEqual(Array.from(d.output.slice(0,4)),[255,255,255,255]);
  const centre=(20*40+20)*4;
  assert.deepEqual(d.output.slice(centre,centre+4),d.original.slice(centre,centre+4));
  assert.deepEqual(result.headRing,{centre:true,background:false});
  assert.deepEqual(d.input,d.original);
 }
});

test('unavailable segmentation still prepares a new opaque white source with an explicit oval warning',async()=>{
 for(const kind of ['missing','throw']){
  const d=preparationSetup(kind),result=await d.prepare(d.photo,d.landmarks);
  assert.equal(result.method,'face-oval-fallback');assert.match(result.warning,/Détourage approximatif/);
  assert.notEqual(result.photo,d.photo);assert.deepEqual(d.input,d.original);
  for(let i=0;i<d.output.length;i+=4){
   assert.equal(d.output[i+3],255);
   if(!result.alpha[i/4])assert.deepEqual(Array.from(d.output.slice(i,i+4)),[255,255,255,255]);
  }
 }
});

function matchedSetup({cancelAfterFirst=false}={}){
 const originals=[{name:'original A'},{name:'original B'}],whites=[{name:'white A'},{name:'white B'}];
 const old=[{name:'previous A'},{name:'previous B'}],savedRing=[{x:999,y:999}],newRings=[[{x:1,y:2}],[{x:3,y:4}]];
 const pair={first:{blob:0,landmarks:['A'],headRing:savedRing},second:{blob:1,landmarks:['B'],headRing:savedRing}};
 const state={applyingPair:false,operationGeneration:0,mode:'full',regionHarmony:0,photos:old,originalPhotos:old,portraitMattes:[],photoVersion:5,morphTopologyVersion:7,meshTriangles:[],buffers:new Map([['old',1]]),animation:{}};
 const elements=new Map(),$=id=>{
  if(!elements.has(id))elements.set(id,{checked:true,classList:{contains:()=>false},style:{},setAttribute(){},removeAttribute(){},focus(){}});
  return elements.get(id);
 };
 const prepared=[],noOp=()=>{};
 const dependencies={state,$,chooseStableMatchedPair:()=>({pair}),disableViewpointControls:noOp,stopAnimation:noOp,updateScanUI:noOp,pairPreparationStatus:noOp,
  blobToCanvas:async id=>originals[id],prepareWhitePortrait:async(photo,marks)=>{
   const index=prepared.length;assert.equal(photo,originals[index]);assert.equal(marks,pair[index?'second':'first'].landmarks);prepared.push(photo);
   if(cancelAfterFirst)state.operationGeneration++;
   return{photo:whites[index],headRing:newRings[index],warning:''};
  },stopCamera:noOp,closeSegmenter:noOp,syncPortraitMatteUI:noOp,invalidateFaceLighting:noOp,automaticHarmony:()=>0,syncRegionControls:noOp,
  makeCanvas:()=>({getContext:()=>({drawImage:noOp}),toDataURL:()=>''}),showStage:noOp,updatePreviewSize:noOp,syncPairUI:noOp,
  autoAlign:noOp,syncViewpointUI:noOp,updateModeAvailability:noOp,canMeshMorph:()=>false,scheduleRender:noOp};
 const apply=new Function(...Object.keys(dependencies),applySource+';return applyMatchedView')(...Object.values(dependencies));
 return{state,apply,originals,whites,newRings,prepared,old};
}

test('an archived head ring never bypasses white preparation and replacement invalidates cached render sources',async()=>{
 const d=matchedSetup();await d.apply();
 assert.deepEqual(d.prepared,d.originals);assert.deepEqual(d.state.originalPhotos,d.originals);
 assert.deepEqual(d.state.photos,d.whites);assert.deepEqual(d.state.headRings,d.newRings);
 assert.equal(d.state.portraitMattes.length,2);assert.equal(d.state.photoVersion,6);
 assert.equal(d.state.morphTopologyVersion,8);assert.equal(d.state.buffers.size,0);assert.equal(d.state.applyingPair,false);
});

test('an interrupted preparation cannot replace the current pair with half of a newly prepared pair',async()=>{
 const d=matchedSetup({cancelAfterFirst:true});await d.apply();
 assert.equal(d.prepared.length,1);assert.equal(d.state.photos,d.old);
 assert.equal(d.state.originalPhotos,d.old);assert.equal(d.state.photoVersion,5);
 assert.equal(d.state.portraitMattes.length,0);assert.equal(d.state.buffers.size,1);
});

test('the actual lighting correction keeps the white background exact and attenuates correction across the matte feather',()=>{
 const size=4,source=new Uint8ClampedArray(size*size*4),alpha=new Uint8ClampedArray(size*size).fill(255);
 for(let i=0;i<size*size;i++)source.set([160,160,160,255],i*4);
 source.set([255,255,255,255],0);alpha[0]=0;
 for(const i of [1,2,3])source.set([224,224,224,255],i*4);
 alpha[1]=64;alpha[2]=128;
 const untouched=source.slice(),photos=[{analysis:96},{analysis:160,data:source}];
 // The canvas double supplies uniform lit skin at analysis resolution. The
 // final four-pixel-wide image contains a white pixel and the real feather.
 // Geometry and masks are held fixed so this exercises the complete lighting
 // calculation, including its actual pixel loop and colour lookup tables.
 const makeCanvas=width=>{
  const canvas={width,height:width,analysis:255,data:null};
  const ctx={drawImage(image){canvas.analysis=image.analysis;canvas.data=image.data},
   getImageData(){
    if(width===size&&canvas.data)return{data:canvas.data.slice()};
    const data=new Uint8ClampedArray(width*width*4);
    for(let i=0;i<width*width;i++)data.set([canvas.analysis,canvas.analysis,canvas.analysis,255],i*4);
    return{data};
   },putImageData(image){canvas.data=image.data}};
  canvas.getContext=()=>ctx;return canvas;
 };
 const state={lighting:{version:-1},photoVersion:1,photos,marks:[Array.from({length:468},()=>({x:.5,y:.5})),Array.from({length:468},()=>({x:.5,y:.5}))],faceOval:[0,1,2],portraitMattes:[null,{alpha}]};
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 const math=between('function boxBlurFloat(','function lightingAnalysisMask(')+between('function linearizePixels(','function lightingGeometryReliable(')+between('function lightingLuts(','function morphPhoto2Key(');
 const dependencies={state,SIZE:size,clamp,smoother:value=>{const x=clamp(value,0,1);return x*x*x*(x*(x*6-15)+10)},
  makeCanvas,lightingAnalysisMask:(_index,width)=>makeCanvas(width),REGION_MOTION_IDS:[],delaunayTriangles:()=>[[0,1,2]],lightingGeometryReliable:()=>true,
  warpTriangle:(ctx,image)=>ctx.drawImage(image),faceOvalWidth:(_index,width)=>width*.6,rawFaceLightingMask:(_index,width)=>makeCanvas(width)};
 const ensure=new Function(...Object.keys(dependencies),math+';return ensureFaceLighting')(...Object.values(dependencies));
 const result=ensure();
 assert.ok(result.corrected,'the real correction must run rather than returning a quality fallback');
 const output=result.corrected.data;
 assert.deepEqual(Array.from(output.slice(0,4)),[255,255,255,255]);
 assert.ok(output[4]<224&&output[4]>output[8]&&output[8]>output[12],'the same edge colour receives progressively less correction near white');
 assert.ok(output[16]<160,'solid skin receives the lighting correction');
 for(let i=3;i<output.length;i+=4)assert.equal(output[i],255);
 assert.deepEqual(source,untouched,'the canonical prepared source remains unchanged');
 assert.equal(ensure(),result,'the prepared correction is cached');
});
