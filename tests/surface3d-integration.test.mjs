import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
function between(start,end){const first=page.indexOf(start),last=page.indexOf(end,first);assert.ok(first>=0&&last>first,'Application adapter delimiters exist');return page.slice(first,last)}
const adapters=between('function surface3DModel(','function manualGeometryIsSafe(');
function setup(){
 const photos=[{name:'prepared A'},{name:'prepared B'}],marks=[[{x:.2,y:.3,z:-.1}],[{x:.6,y:.5,z:-.2}]],triangles=[[0,1,2]],calls=[];
 const state={photos,marks,pair:{fullOnly:false},photoVersion:7,morphTopologyVersion:3,faceOval:[0,1,2],meshTriangles:[[2,3,4]],surfaceMaterial:'clay',surfaceYaw:.1,surfacePitch:-.2};
 const geometry={points:[{x:.2,y:.3,z:-.1}],positions:new Float32Array(9),normals:new Float32Array(9),textureMix:.5};
 const model={sample(t,angles){calls.push({kind:'sample',t,angles});return geometry}},image={name:'rendered 3D surface'};
 const renderer={render(options){calls.push({kind:'render',options});return image},dispose(){calls.push({kind:'dispose'})}};
 const ctx={setTransform(){},fillRect(){calls.push({kind:'white',color:this.fillStyle,alpha:this.globalAlpha,composite:this.globalCompositeOperation})},drawImage(...args){calls.push({kind:'draw',args})}},canvas={width:192,height:192,getContext:()=>ctx};
 const flags={mesh:true,validPath:true,model:true,renderError:null,quality:{valid:true,flipArea:0,collapseArea:0}};
 const dependencies={state,SIZE:768,canMeshMorph:()=>flags.mesh,fullMorphGeometry(){calls.push({kind:'path'});if(!flags.validPath)return null;state.fullMorphCache={model:{sample:()=>({triangles})},visibility:{sample:(t,target)=>{calls.push({kind:'visibility',t,target});return{regions:[]}}}};return{}},
  assessSampledMorphPath(first,second,skinTriangles,sample){calls.push({kind:'quality',first,second,skinTriangles,quarter:sample(.25),threeQuarter:sample(.75)});return flags.quality},
  createFaceSurface3D(a,b,inputTriangles,options){calls.push({kind:'build',a,b,inputTriangles,options});return flags.model?model:null},
  openingMixMap(input,size){calls.push({kind:'mixMap',input,size});return{canvas:{name:'opening map'},key:'surface3d|0.5'}},
  createSurface3DRenderer(){calls.push({kind:'renderer'});return{...renderer,render(options){if(flags.renderError)throw Error(flags.renderError);return renderer.render(options)}}}};
 const api=new Function(...Object.keys(dependencies),adapters+';return{surface3DModel,surface3DGeometry,renderSurface3DMorph,disposeSurface3D}')(...Object.values(dependencies));
 return{...api,state,flags,calls,photos,marks,triangles,model,geometry,canvas,image};
}

test('3D adapter validates the common path and caches success or refusal for the actual source/topology version',()=>{
 const d=setup();assert.equal(d.surface3DModel(),d.model);assert.equal(d.surface3DModel(),d.model);
 assert.equal(d.calls.filter(c=>c.kind==='build').length,1);assert.equal(d.calls.filter(c=>c.kind==='path').length,1);
 const build=d.calls.find(c=>c.kind==='build');assert.equal(build.a,d.marks[0]);assert.equal(build.b,d.marks[1]);assert.equal(build.inputTriangles,d.triangles);assert.equal(build.options.size,768);
 d.state.photoVersion++;d.surface3DModel();assert.equal(d.calls.filter(c=>c.kind==='build').length,2);
 d.state.morphTopologyVersion++;d.flags.model=false;assert.equal(d.surface3DModel(),null);assert.equal(d.surface3DModel(),null);assert.equal(d.calls.filter(c=>c.kind==='build').length,3);assert.match(d.state.surface3DCache.warning,/3D invalide/);
 d.flags.model=true;d.flags.validPath=false;d.state.photoVersion++;assert.equal(d.surface3DModel(),null);assert.match(d.state.surface3DCache.warning,/commune non validée/);assert.equal(d.calls.filter(c=>c.kind==='build').length,3);
});

test('a validated 3D trajectory remains available when legacy 2D recentering is refused',()=>{
 const d=setup();d.flags.mesh=false;assert.equal(d.surface3DModel(),null);assert.equal(d.calls.length,0);
 d.flags.mesh=true;d.state.pair.fullOnly=true;assert.equal(d.surface3DModel(),d.model);assert.equal(d.state.surface3DCache.quality,d.flags.quality);
 const quality=d.calls.find(c=>c.kind==='quality');assert.equal(quality.skinTriangles,d.state.meshTriangles);assert.deepEqual(quality.first,[{x:.2*768,y:.3*768}]);assert.deepEqual(quality.second,quality.first);assert.deepEqual(quality.quarter,quality.first);assert.deepEqual(quality.threeQuarter,quality.first);
});

test('the actual projected 3D path is refused for invalid, excessive or non-finite sampled quality',()=>{
 for(const quality of [{valid:false,flipArea:0,collapseArea:0},{valid:true,flipArea:.040001,collapseArea:0},{valid:true,flipArea:0,collapseArea:.080001},{valid:true,flipArea:NaN,collapseArea:0},{valid:true,flipArea:0,collapseArea:Infinity}]){
  const d=setup();d.flags.quality=quality;assert.equal(d.surface3DModel(),null);assert.equal(d.surface3DModel(),null);assert.equal(d.calls.filter(c=>c.kind==='quality').length,1);assert.match(d.state.surface3DCache.warning,/projetée.*non validée/);
 }
});

test('both 3D endpoints are rasterized as surfaces rather than replaced by either source photograph',()=>{
 for(const amount of [0,1]){
  const d=setup(),result=d.renderSurface3DMorph(d.canvas,{a:amount});
  assert.equal(result.fallback,false);assert.equal(result.surface3d,true);assert.equal(result.renderer,'webgl');
  assert.equal(d.calls.filter(c=>c.kind==='sample').at(-1).t,amount);
  assert.deepEqual(d.calls.filter(c=>c.kind==='draw').map(c=>c.args[0]),[d.image]);
  assert.ok(!d.calls.some(c=>c.kind==='draw'&&d.photos.includes(c.args[0])));
  assert.deepEqual(d.calls.find(c=>c.kind==='white'),{kind:'white',color:'#fff',alpha:1,composite:'source-over'});
  assert.equal(d.calls.find(c=>c.kind==='render').options.material,'clay');assert.ok(!d.calls.some(c=>c.kind==='mixMap'));
 }
});

test('photo projection follows 3D frontal coordinates for visibility and honors angle/source overrides without cache reuse',()=>{
 const d=setup(),overrides=[{name:'diagnostic A'},{name:'diagnostic B'}],result=d.renderSurface3DMorph(d.canvas,{a:.5},overrides,{material:'texture',yaw:.3,pitch:-.1});
 assert.equal(result.fallback,false);assert.deepEqual(d.calls.filter(c=>c.kind==='sample').at(-1).angles,{yaw:.3,pitch:-.1});
 const options=d.calls.find(c=>c.kind==='render').options;assert.equal(options.sources,overrides);assert.equal(options.geometry,d.geometry);assert.equal(options.textureVersion,null);assert.equal(options.material,'texture');assert.equal(options.mixMap.key,'surface3d|0.5');
 const visibility=d.calls.find(c=>c.kind==='visibility');assert.deepEqual(visibility.target,[{x:.2*768,y:.3*768}]);
 assert.equal(d.calls.find(c=>c.kind==='mixMap').input.sourceKey,'surface3d');
 d.renderSurface3DMorph(d.canvas,{a:.5},null,{material:'texture'});assert.equal(d.calls.filter(c=>c.kind==='renderer').length,1);assert.equal(d.calls.filter(c=>c.kind==='render').at(-1).options.textureVersion,7);
});

test('missing geometry or a WebGL failure leaves an opaque white frame with an explicit error and no hidden 2D overlay',()=>{
 for(const failure of ['geometry','gpu']){
  const d=setup();if(failure==='geometry')d.flags.validPath=false;else d.flags.renderError='Context lost';
  const result=d.renderSurface3DMorph(d.canvas,{a:.5});assert.equal(result.fallback,true);assert.equal(result.renderer,'unavailable');assert.equal(result.surface3d,true);assert.match(result.message,/indisponible/);assert.equal(d.calls.filter(c=>c.kind==='draw').length,0);assert.equal(d.calls.filter(c=>c.kind==='white').length,1);
 }
});

test('releasing the 3D adapter disposes its GPU resources and invalidates its model',()=>{
 const d=setup();d.renderSurface3DMorph(d.canvas,{a:.5});d.disposeSurface3D();assert.equal(d.state.surface3DRenderer,null);assert.equal(d.state.surface3DCache,null);assert.equal(d.calls.filter(c=>c.kind==='dispose').length,1);d.disposeSurface3D();assert.equal(d.calls.filter(c=>c.kind==='dispose').length,1);
});

test('2D and 3D visibility maps own separate canvases, so a cached GPU map cannot be overwritten by the other mode',()=>{
 const source=between('function openingMixMap(','function renderFullMorph('),buffers=new Map(),state={photoVersion:1,morphTopologyVersion:1};
 const getBuffer=(name,size)=>{const key=name+'|'+size;if(!buffers.has(key)){const ctx={createImageData:()=>({data:new Uint8ClampedArray(size*size*4)}),putImageData(){}};buffers.set(key,{getContext:()=>ctx})}return buffers.get(key)};
 const get=new Function('state','SIZE','getBuffer','clamp','openingMaskAlpha',source+';return openingMixMap')(state,768,getBuffer,(n,lo,hi)=>Math.max(lo,Math.min(hi,n)),()=>0);
 const visibility={regions:[]},full=get({t:.25,sourceKey:'full-raw|1',openingVisibility:visibility},8),surface=get({t:.75,sourceKey:'surface3d',openingVisibility:visibility},8);
 assert.notEqual(full.key,surface.key);assert.notEqual(full.canvas,surface.canvas,'two cache keys must not alias one mutable canvas');assert.ok(Math.abs(full.weights[0]-Math.round(.25*65535)/65535)<1e-7);assert.ok(Math.abs(surface.weights[0]-Math.round(.75*65535)/65535)<1e-7);
});

test('animated frames preserve the surface3d engine and carry the evolving identity amount',()=>{
 const source=between('function animationFrame(){','function automaticMotionReduced(');
 const state={mode:'surface3d',animation:{baseControls:{a:.5},phase:1,ramp:1}};
 const frame=new Function('state','animationSettings','smoothstep','oscillatedBounded','animationSnapshot',source+';return animationFrame')(
  state,()=>({amplitude:.45}),x=>x,()=>.75,(mode,values,regions)=>({mode,values,regions}))();
 assert.equal(frame.mode,'surface3d');assert.equal(frame.values.a,.75);assert.equal(frame.regions,null);
});
