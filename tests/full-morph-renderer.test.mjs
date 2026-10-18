import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const between=(start,end)=>page.slice(page.indexOf(start),page.indexOf(end,page.indexOf(start)));
const endpoint=between('function renderPortraitEndpoint(','// Match WebGL');
const renderSource=between('function renderFullMorph(','function manualGeometryIsSafe(');
const canvasSource=between('function renderCanvasMorph(','function compileShader(');

function setup(engine='webgl'){
 const calls=[],photos=[{name:'raw A'},{name:'raw B'}];
 const ctx={setTransform(){},clearRect(){calls.push('clear')},drawImage(image){calls.push(image)},
  getImageData:()=>({data:new Uint8ClampedArray([0,0,0,255])}),putImageData(){}};
 const canvas={width:384,height:384,getContext:()=>ctx};
 const geometry={target:[],raw1:[],raw2:[],triangles:[[0,1,2]],contextTriangles:[],t:.5,regularization:.35,sourceKey:'full-raw|1'};
 const morphPhoto=()=>{throw Error('Full morph must not use harmonized or frozen source textures')};
 const renderPortraitEndpoint=new Function('morphPhoto',endpoint+';return renderPortraitEndpoint')(morphPhoto);
 const render=new Function('state','renderPortraitEndpoint','fullMorphGeometry','renderWebGLFace','renderCanvasMorph',
  renderSource+';return renderFullMorph')({photos},renderPortraitEndpoint,()=>geometry,
  (_size,g,sources)=>{calls.push({kind:'webgl',geometry:g,sources});return engine==='webgl'?{name:'warped pair'}:null},
  (_canvas,_v,g,sources)=>{calls.push({kind:'canvas',geometry:g,sources});return{fallback:false,renderer:'canvas'}});
 return{render,photos,calls,canvas,geometry};
}

test('new renderer shows exact raw A/B at endpoints and honors diagnostic source overrides',()=>{
 const d=setup();
 for(const [t,index] of [[0,0],[1,1]]){
  d.calls.length=0;const result=d.render(d.canvas,{a:t});
  assert.equal(result.fallback,false);assert.equal(result.renderer,'canvas');
  assert.deepEqual(d.calls.filter(call=>call!=='clear'),[d.photos[index]]);
  const overrides=[{name:'neutral A'},{name:'neutral B'}];d.calls.length=0;
  d.render(d.canvas,{a:t},overrides);assert.equal(d.calls.at(-1),overrides[index]);
 }
});

test('full morph uses the same geometry and raw pair through WebGL and Canvas without overlaying A',()=>{
 for(const engine of ['webgl','canvas']){
  const d=setup(engine),result=d.render(d.canvas,{a:.5});
  assert.equal(result.renderer,engine);assert.equal(result.fallback,false);
  const renderCall=d.calls.find(call=>call.kind===engine);
  assert.equal(renderCall.geometry,d.geometry);assert.equal(renderCall.sources,d.photos);
  assert.ok(!d.calls.includes(d.photos[0]));assert.ok(!d.calls.includes(d.photos[1]));
  assert.doesNotMatch(renderSource,/drawBackground|localExpressionMask|localAppearanceMix/);
 }
});

test('Canvas respects a provided geometry at 100% instead of jumping to an unaligned endpoint',()=>{
 const d=setup(),warps=[];
 const render=new Function('renderPortraitEndpoint','meshGeometry','fullFrameGeometry','renderAlphaFallback',
  'state','morphPhoto','warpImage','getBuffer','blendMorphPixels','lightingStatus',canvasSource+';return renderCanvasMorph')(
  ()=>{throw Error('Unexpected raw endpoint')},()=>null,()=>null,()=>({fallback:true}),{photos:d.photos},()=>d.photos[1],
  (...args)=>{warps.push(args);return d.canvas},()=>d.canvas,()=>{},()=> 'test');
 const result=render(d.canvas,{a:1},d.geometry,d.photos);
 assert.equal(result.fallback,false);assert.equal(warps.length,2);
 assert.equal(warps[0][2],d.photos[0]);assert.equal(warps[1][2],d.photos[1]);
 assert.equal(warps[1][4],d.geometry.target);
});

test('animation and diagnostics retain the complete identity morph mode',()=>{
 const source=between('function animationFrame(){','function automaticMotionReduced()');
 const state={mode:'full',animation:{baseControls:{a:.5},phase:1,ramp:1}};
 const frame=new Function('state','animationSettings','smoothstep','oscillatedBounded','animationSnapshot',source+';return animationFrame')(
  state,()=>({amplitude:.45}),x=>x,()=>.75,(mode,values,regions)=>({mode,values,regions}))();
 assert.equal(frame.mode,'full');assert.equal(frame.values.a,.75);assert.equal(frame.regions,null);
 assert.match(page,/if\(mode==='full'\)info=renderFullMorph\(canvas,v,sourceOverrides\)/);
 assert.match(page,/state\.mode==='full'\?fullMorphGeometry\(v\)/);
});

test('the new adapter validates the unaligned camera path before building its cached model',()=>{
 const source=between('function fullMorphGeometry(','function renderFullMorph(');
 for(const [flipArea,collapseArea,expected] of [[0,0,true],[.1,0,false],[0,.2,false]]){
  const first=[],second=[],state={photoVersion:1,morphTopologyVersion:2,meshTriangles:[],faceOval:[],headRings:[[],[]]};
  let built=0,assessed=0;
  const get=new Function('canMeshMorph','state','landmarkPoints','assessMorphTopology','createFullFaceMorph','fallbackHeadRing','fullFrameGeometry',source+';return fullMorphGeometry')(
   ()=>true,state,i=>i?second:first,(a,b)=>{assert.equal(a,first);assert.equal(b,second);assessed++;return{flipArea,collapseArea}},
   ()=>{built++;return{sample:()=>({raw1:[],raw2:[],target:[],triangles:[],t:.5,regularization:.1})}},()=>[],
   ()=>({contextTriangles:[],raw1:[],raw2:[],target:[]}));
  assert.equal(!!get({a:.5}),expected);assert.equal(!!get({a:.5}),expected);
  assert.equal(assessed,1);assert.equal(built,expected?1:0);
 }
});
