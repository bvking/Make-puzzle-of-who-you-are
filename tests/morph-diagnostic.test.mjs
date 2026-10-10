import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const start=page.indexOf('function diagnosticMorphValue(');
const end=page.indexOf('function captureMorphDiagnostic(',start);
assert.ok(start>=0&&end>start,'diagnostic helper functions must exist');
const {diagnosticMorphValue,diagnosticMorphEngine,diagnosticFrameDifference}=
 new Function(page.slice(start,end)+';return {diagnosticMorphValue,diagnosticMorphEngine,diagnosticFrameDifference}')();

test('three diagnostic steps supply exact normalized morph positions',()=>{
 const controls={x:0,y:0,s:1,r:0,a:.99};
 for(const percent of [25,50,75]){
  const actual=diagnosticMorphValue(controls,percent);
  assert.equal(actual.a,percent/100);
  assert.equal(actual.s,1);
  assert.equal(controls.a,.99,'the original input is not mutated');
 }
 assert.equal(diagnosticMorphValue(controls,0).a,0);
 assert.equal(diagnosticMorphValue(controls,100).a,1);
 assert.throws(()=>diagnosticMorphValue(controls,NaN),/invalide/);
});

test('actual renderer is distinguished from fallback and failed WebGL',()=>{
 assert.equal(diagnosticMorphEngine({fallback:false,renderer:'webgl'}),'webgl');
 assert.equal(diagnosticMorphEngine({fallback:false,renderer:'canvas'}),'canvas');
 assert.equal(diagnosticMorphEngine({fallback:true,renderer:'canvas'}),'fallback');
 assert.equal(diagnosticMorphEngine(null),'inconnu');
 assert.match(page,/if\(engine==='fallback'\|\|engine==='inconnu'\)/);
 assert.match(page,/if\(engine!==state\.mode\)problems\.push/);
});

test('diagnostic checks three real intermediate frames and rejects invalid geometry',()=>{
 assert.match(page,/for\(const position of \[25,50,75\]\)/);
 assert.match(page,/Math\.abs\(geometry\.t-position\/100\)>1e-8/);
 assert.match(page,/renderSelected\(alignCanvas,\{updateUI:false,values:v,mode:state\.mode\}\)/);
 assert.match(page,/copy\('diagnostic'\+position,alignCanvas\)/);
 assert.match(page,/gl\.uniform1f\(r\.locations\.mix,geometry\.t\)/);
 assert.match(page,/blendMorphPixels\(pixelsA\.data,pixelsB\.data,geometry\.t,pixelsA\.data\)/);
});

test('image delta check detects frozen frames independently of their engine',()=>{
 const frame=data=>({width:2,height:2,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(data)})})});
 const black=frame([0,0,0,255,0,0,0,255,0,0,0,255,0,0,0,255]);
 const white=frame([255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255]);
 assert.equal(diagnosticFrameDifference(black,black),0);
 assert.ok(diagnosticFrameDifference(black,white)>100);
});
