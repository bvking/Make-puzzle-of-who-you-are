import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the application's actual policy and dispatch functions. These mocks
// carry no photographs, scans or private landmarks and do not replace geometry
// tests: their purpose is to ensure a validated full path cannot enable an
// independently refused legacy path.
const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
function between(start,end){const from=page.indexOf(start),to=page.indexOf(end,from);assert.ok(from>=0&&to>from,'Application helper not found: '+start);return page.slice(from,to)}
const policySource=between('function fullOnlyCompatibility(','function autoAlign(');
const geometrySource=between('function fullMorphGeometry(','// One target-space texture-weight map');
const availabilitySource=between('function updateModeAvailability(','function meshGeometry(');
const modeSource=between('function setMode(','document.querySelectorAll(\'[data-mode]\').forEach(button=>button.addEventListener');
const dispatchSource=between('function renderSelected(','// Diagnostic: neutralize each source');
const legacyModes=['local','stabilized','canvas','webgl','regions'];
const goodQuality=()=>({valid:true,flipArea:.001,collapseArea:.002});
const refusedLegacy=()=>({status:'unusable',compatible:false,score:49,reasons:['aligned B exceeds its frame'],advice:['retake B'],metrics:{warp:{maxOverflow:38.16,outsideArea:.02058}},alignment:{scale:1.358,rot:.03,tx:-142,ty:-199}});

function policy({hasPair=true,crops=[{outsideArea:0,maxOverflow:0},{outsideArea:0,maxOverflow:0}],portrait={},quality=goodQuality()}={}){
 const state={fullMorphCache:{quality}},points=[{source:0},{source:1}],calls={crops:[],portrait:[]};
 const fullOnlyCompatibility=new Function('state','hasLandmarkPair','landmarkPoints','faceOvalCrop','fullMorphGeometry','clamp',policySource+';return fullOnlyCompatibility')(
  state,()=>hasPair,index=>points[index],point=>{calls.crops.push(point.source);return crops[point.source]},
  (values,options)=>{calls.portrait.push({values,options});return portrait},(v,a,b)=>Math.max(a,Math.min(b,v)));
 return{fullOnlyCompatibility,state,calls};
}

test('full-only exception is considered only for an independently refused legacy pair with complete landmarks',()=>{
 for(const status of ['good','adapted','checking','empty']){
  const d=policy();assert.equal(d.fullOnlyCompatibility({...refusedLegacy(),status}),null);assert.deepEqual(d.calls,{crops:[],portrait:[]});
 }
 const d=policy({hasPair:false});assert.equal(d.fullOnlyCompatibility(refusedLegacy()),null);assert.deepEqual(d.calls,{crops:[],portrait:[]});
});

test('raw crop failure or non-finite crop measurements on either photograph cannot be overridden',()=>{
 for(const index of [0,1])for(const invalid of [
  {outsideArea:.040001,maxOverflow:0},{outsideArea:0,maxOverflow:30.001},
  {outsideArea:NaN,maxOverflow:0},{outsideArea:Infinity,maxOverflow:0},
  {outsideArea:0,maxOverflow:NaN},{outsideArea:0,maxOverflow:Infinity}
 ]){
  const crops=[{outsideArea:0,maxOverflow:0},{outsideArea:0,maxOverflow:0}];crops[index]=invalid;
  const d=policy({crops});assert.equal(d.fullOnlyCompatibility(refusedLegacy()),null,'raw source '+index);assert.equal(d.calls.portrait.length,0);
 }
});

test('a missing portrait, invalid sampled path, excessive flips or excessive collapses keep the legacy refusal',()=>{
 for(const options of [
  {portrait:null},{quality:undefined},{quality:null},{quality:{valid:false,flipArea:0,collapseArea:0}},{quality:{valid:true,flipArea:NaN,collapseArea:0}},{quality:{valid:true,flipArea:0,collapseArea:Infinity}},
  {quality:{valid:true,flipArea:.040001,collapseArea:0}},{quality:{valid:true,flipArea:0,collapseArea:.080001}}
 ]){
  const d=policy(options);
  // An explicit undefined must test a missing quality, rather than the helper's
  // default parameter used for other cases.
  if(Object.hasOwn(options,'quality')&&options.quality===undefined)d.state.fullMorphCache.quality=undefined;
  assert.equal(d.fullOnlyCompatibility(refusedLegacy()),null);
  assert.deepEqual(d.calls.portrait,[{values:{a:.5},options:{validateOnly:true}}]);
 }
});

test('validated raw crops and full path enable only full while preserving the complete legacy rejection',()=>{
 const legacy=refusedLegacy(),before=structuredClone(legacy),quality={valid:true,flipArea:.04,collapseArea:.08};
 const d=policy({crops:[{outsideArea:.04,maxOverflow:30},{outsideArea:0,maxOverflow:0}],quality});
 const result=d.fullOnlyCompatibility(legacy);
 assert.equal(result.status,'adapted');assert.equal(result.fullOnly,true);assert.equal(result.legacy,legacy);assert.deepEqual(legacy,before);assert.equal(result.legacy.compatible,false);
 assert.equal(result.metrics.fullPath,quality);assert.equal(result.metrics.rawCrops.length,2);assert.ok(result.score>=50&&result.score<=99);assert.notDeepEqual(result.reasons,legacy.reasons);
 assert.deepEqual(d.calls.crops,[0,1]);assert.deepEqual(d.calls.portrait,[{values:{a:.5},options:{validateOnly:true}}]);
});

function geometry({hasPair=true,pairUsable=false,quality=goodQuality(),portrait={contextTriangles:[]}}={}){
 const first=[{x:1,y:2}],second=[{x:3,y:4}],state={photoVersion:7,morphTopologyVersion:3,meshTriangles:[],faceOval:[],headRings:[[],[]]},calls={build:0,portrait:0};
 const fullMorphGeometry=new Function('state','hasLandmarkPair','canMeshMorph','landmarkPoints','createFullFaceMorph','createOpeningVisibility','fallbackHeadRing','fullFrameGeometry',geometrySource+';return fullMorphGeometry')(
  state,()=>hasPair,()=>pairUsable,index=>index?second:first,
  ()=>{calls.build++;return{quality,interpolateContext:()=>[],sample:t=>({raw1:first,raw2:second,target:first,triangles:[[0,1,2]],t,regularization:0})}},
  ()=>({sample:t=>({t,regions:[]})}),()=>[],face=>{calls.portrait++;assert.equal(typeof face.sampleFace,'function');assert.equal(typeof face.interpolateContext,'function');return portrait});
 return{fullMorphGeometry,state,calls};
}

test('validation-only adapter can inspect a refused pair without weakening the normal pair gate',()=>{
 const d=geometry();assert.equal(d.fullMorphGeometry({a:.5}),null);assert.equal(d.calls.build,0);
 assert.ok(d.fullMorphGeometry({a:.5},{validateOnly:true}));assert.equal(d.calls.build,1);assert.equal(d.calls.portrait,1);
 assert.equal(d.fullMorphGeometry({a:.5}),null,'validation must not silently make the pair usable');
 const missing=geometry({hasPair:false});assert.equal(missing.fullMorphGeometry({a:.5},{validateOnly:true}),null);assert.equal(missing.calls.build,0);
});

test('validation-only adapter still refuses every invalid model quality and a failed portrait trajectory',()=>{
 for(const quality of [undefined,null,{valid:false,flipArea:0,collapseArea:0},{valid:true,flipArea:NaN,collapseArea:0},{valid:true,flipArea:Infinity,collapseArea:0},{valid:true,flipArea:.041,collapseArea:0},{valid:true,flipArea:0,collapseArea:.081}]){
  const d=geometry({quality});if(quality===undefined)d.state.fullMorphCache={key:'7|3',quality:undefined,model:null};
  assert.equal(d.fullMorphGeometry({a:.5},{validateOnly:true}),null);assert.equal(d.calls.portrait,0);
 }
 const d=geometry({portrait:null});assert.equal(d.fullMorphGeometry({a:.5},{validateOnly:true}),null);assert.equal(d.calls.portrait,1);
});

function button(mode){return{dataset:{mode},disabled:false,attributes:{},classList:{toggle(){},remove(){}},setAttribute(name,value){this.attributes[name]=value}}}
function controls(){const elements=new Map();return id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',value:''});return elements.get(id)}}

test('mode availability exposes only full for a full-only pair and disables every mode when the pair is unusable',()=>{
 for(const available of [true,false]){
  const state={pair:{fullOnly:true},mode:'regions',photoVersion:1,previewTrianglesVersion:1},buttons=['full',...legacyModes].map(button);
  const update=new Function('state','canMeshMorph','document','buildMorphTriangles','buildPreviewTriangles','stopAnimation','$','setMode','syncAnimationControls','syncPairUI',availabilitySource+';return updateModeAvailability')(
   state,()=>available,{querySelectorAll:()=>buttons},()=>{throw Error('Unexpected rebuild')},()=>[],()=>{},controls(),()=>{throw Error('Unexpected legacy mode selection')},()=>{},()=>{});
  update();assert.equal(state.mode,available?'full':'fallback');assert.equal(buttons[0].disabled,!available);
  for(const b of buttons.slice(1))assert.equal(b.disabled,true,b.dataset.mode);
 }
});

test('direct legacy mode selection cannot bypass disabled buttons on a full-only pair',()=>{
 const state={pair:{fullOnly:true},mode:'full',animation:{}},calls=[];
 const setMode=new Function('state','canMeshMorph','stopAnimation','disposeWebGL','document','$','syncRegionControls','syncPairUI','syncAnimationControls','scheduleRender','maybeAutoStartAnimation',modeSource+';return setMode')(
  state,()=>true,()=>calls.push('stop'),()=>{}, {querySelectorAll:()=>[]},controls(),()=>{},()=>calls.push('ui'),()=>{},()=>calls.push('render'),()=>{});
 for(const mode of [...legacyModes,'unknown']){setMode(mode);assert.equal(state.mode,'full');assert.deepEqual(calls,[])}
 setMode('full');assert.equal(state.mode,'full');assert.ok(calls.includes('render'));
});

function dispatch(fullOnly){
 const state={pair:{fullOnly},mode:'full',photos:[{},{}],regionMix:{}},calls=[],names=['renderFullMorph','renderLocalExpressions','renderStabilizedFace','renderWebGLMorph','renderRegions','renderAlphaFallback','renderCanvasMorph'];
 const renderers=names.map(name=>(...args)=>{const result={name};calls.push({name,args});return result});
 const renderSelected=new Function('state','readControls',...names,'updateControlLabels','$',dispatchSource+';return renderSelected')(
  state,()=>({a:.123}),...renderers,()=>{},controls());
 return{renderSelected,calls};
}

test('old render snapshots cannot reach legacy renderers after a pair becomes full-only',()=>{
 const d=dispatch(true),canvas={},overrides=[{neutral:'A'},{neutral:'B'}];
 for(const mode of [...legacyModes,'fallback','unknown'])for(const amount of [0,.5,1]){
  const values={a:amount,x:14,y:-9,s:1.4,r:8};d.calls.length=0;
  const result=d.renderSelected(canvas,{updateUI:false,mode,values,sourceOverrides:overrides});
  assert.equal(result.name,'renderFullMorph');assert.equal(d.calls.length,1);assert.deepEqual(d.calls[0].args,[canvas,values,overrides]);
 }
});

test('independently usable legacy modes retain their normal dispatch',()=>{
 const d=dispatch(false),expected={local:'renderLocalExpressions',stabilized:'renderStabilizedFace',canvas:'renderCanvasMorph',webgl:'renderWebGLMorph',regions:'renderRegions'};
 for(const [mode,name] of Object.entries(expected)){d.calls.length=0;assert.equal(d.renderSelected({}, {updateUI:false,mode,values:{a:.5}}).name,name);assert.equal(d.calls.length,1)}
});
