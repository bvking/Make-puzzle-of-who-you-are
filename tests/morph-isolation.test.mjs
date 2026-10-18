import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const start=page.indexOf('function diagnosticNeutralPortrait(');
const end=page.indexOf('function diagnosticMorphValue(',start);
assert.ok(start>=0&&end>start,'source-neutralization functions must exist');

const sourceCode=page.slice(start,end);
function setup(){
 const calls=[];
 const makeCanvas=size=>{
  const context={fillRect:(...x)=>calls.push(['fillRect',...x]),save:()=>calls.push(['save']),beginPath:()=>calls.push(['beginPath']),moveTo:(...x)=>calls.push(['moveTo',...x]),lineTo:(...x)=>calls.push(['lineTo',...x]),closePath:()=>calls.push(['closePath']),clip:()=>calls.push(['clip']),drawImage:(...x)=>calls.push(['drawImage',...x]),restore:()=>calls.push(['restore']),set fillStyle(value){calls.push(['fillStyle',value])}};
  return {width:size,height:size,getContext:()=>context};
 };
 const photoA={name:'photoA'},photoB={name:'photoB'};
 const state={faceOval:Array.from({length:36},(_,i)=>i),photos:[photoA,photoB]};
 const injected=new Function('makeCanvas','SIZE','state','commonLandmarkCount','morphPhoto',sourceCode+';return {diagnosticNeutralPortrait,diagnosticNeutralSources}');
 const functions=injected(makeCanvas,768,state,()=>468,()=>photoB);
 return {calls,state,photoA,photoB,...functions};
}
function geometry(){
 const face=Array.from({length:468},()=>({x:384,y:384}));
 const ring=Array.from({length:36},(_,i)=>({x:384+180*Math.cos(i*Math.PI/18),y:384+200*Math.sin(i*Math.PI/18)}));
 const tail=Array.from({length:72},()=>({x:100,y:100}));
 return {raw1:[...face,...ring,...tail],raw2:[...face,...ring,...tail]};
}

test('neutral portrait clips original image before any mesh deformation, preserving the source',()=>{
 const d=setup(),out=d.diagnosticNeutralSources(geometry());
 assert.equal(out.length,2);
 assert.equal(out[0].width,768);
 assert.equal(out[1].height,768);
 assert.equal(d.calls.filter(c=>c[0]==='fillRect').length,2);
 assert.equal(d.calls.filter(c=>c[0]==='clip').length,2);
 const imageOps=d.calls.filter(c=>c[0]==='drawImage');
 assert.equal(imageOps.length,2);
 assert.equal(imageOps[0][1],d.photoA);
 assert.equal(imageOps[1][1],d.photoB);
 assert.ok(d.calls.findIndex(c=>c[0]==='clip')<d.calls.findIndex(c=>c[0]==='drawImage'));
 assert.equal(d.state.photos[0],d.photoA);
 assert.equal(d.state.photos[1],d.photoB);
});

test('neutral portrait refuses invalid or absent silhouette contour',()=>{
 const d=setup();
 assert.throws(()=>d.diagnosticNeutralPortrait(d.photoA,null),/Contour/);
 assert.throws(()=>d.diagnosticNeutralPortrait(d.photoA,[{x:0,y:0}]),/Contour/);
 const invalid=Array.from({length:36},()=>({x:NaN,y:0}));
 assert.throws(()=>d.diagnosticNeutralPortrait(d.photoA,invalid),/Contour/);
 assert.throws(()=>d.diagnosticNeutralSources({raw1:[],raw2:[]}),/Contour/);
});

test('both modes use the same mesh and explicit source overrides',()=>{
 assert.match(page,/sourceOverrides\|\|\[state\.photos\[0\],morphPhoto\(1\)\]/);
 assert.match(page,/function renderWebGLFace\(size,geometry,sourceOverrides=null\)/);
 assert.match(page,/const textureVersion=sourceOverrides\?\(geometry\.sourceKey\?\?null\):morphPhoto2Key\(\)/);
 assert.match(page,/if\(textureVersion===null\|\|r\.textureVersion!==textureVersion\)/);
 assert.match(page,/renderWebGLFace\(canvas\.width,geometry,sourceOverrides\)/);
 assert.match(page,/renderCanvasMorph\(canvas,v,geometry,sourceOverrides\)/);
 assert.match(page,/renderSelected\(alignCanvas,\{updateUI:false,values:v,mode:state\.mode,sourceOverrides:neutralSources\}\)/);
 assert.match(page,/for\(const position of \[25,50,75\]\)/);
 for(const percent of [25,50,75])assert.match(page,new RegExp('id="diagnosticNeutral'+percent+'"'));
 assert.match(page,/id="diagnosticNeutralEnabled" type="checkbox" checked/);
});

test('isolation is not a mask over the final merged portrait',()=>{
 const start=page.indexOf('function diagnosticNeutralSources('),end=page.indexOf('function diagnosticMorphValue(',start);
 const isolated=page.slice(start,end);
 assert.match(isolated,/diagnosticNeutralPortrait\(state\.photos\[0\],ringA\)/);
 assert.match(isolated,/diagnosticNeutralPortrait\(geometry\.fullMorph\?state\.photos\[1\]:morphPhoto\(1\),ringB\)/);
 assert.doesNotMatch(isolated,/alignCanvas/);
});
