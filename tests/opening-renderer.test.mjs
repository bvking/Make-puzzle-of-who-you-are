import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOpeningVisibility,openingMaskAlpha,openingTextureWeight} from '../Taquin deux visages interpolés/opening-visibility.mjs';

const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const mapSource=page.slice(page.indexOf('function openingMixMap('),page.indexOf('function renderFullMorph('));
const blendSource=page.slice(page.indexOf('const MORPH_LINEAR='),page.indexOf('function renderCanvasMorph('));
const {blendMorphPixels}=new Function(blendSource+';return {blendMorphPixels}')();
// This fixture describes only the portraits already published in this repo.
const fixture=JSON.parse(readFileSync(new URL('../Taquin deux visages interpolés/qa/portrait-landmarks.json',import.meta.url),'utf8'));
const faces=['visage_homme.png','visage_femme.png'].map(name=>fixture[name].map(p=>({x:p.x*768,y:p.y*768})));
const model=createOpeningVisibility(...faces);
const geometry=t=>({t,fullMorph:true,openingVisibility:model.sample(t)});
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const quantized=value=>Math.round(value*65535)/65535;

function renderer(){
 const state={photoVersion:3,morphTopologyVersion:7},created=[];
 const getBuffer=(name,size)=>{
  const canvas={name,width:size,height:size,pixels:null};
  const context={
   createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
   putImageData(image){canvas.pixels=new Uint8ClampedArray(image.data)}
  };
  canvas.getContext=type=>{assert.equal(type,'2d');return context};
  created.push(canvas);return canvas;
 };
 const openingMixMap=new Function('state','getBuffer','SIZE','openingMaskAlpha','clamp',mapSource+';return openingMixMap')(
  state,getBuffer,768,openingMaskAlpha,(value,min,max)=>Math.max(min,Math.min(max,value)));
 return {openingMixMap,state,created};
}

test('actual target-space map encodes identical 16-bit RG weights for Canvas and WebGL',()=>{
 const {openingMixMap}=renderer(),size=128,g=geometry(.37),map=openingMixMap(g,size),pixels=map.canvas.pixels,q=size/768;
 assert.equal(map.weights.length,size*size);
 assert.equal(pixels.length,size*size*4);
 let biasedPixels=0,ordinaryPixels=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=y*size+x,i=p*4,point={x:(x+.5)/q,y:(y+.5)/q};
  const expected=openingTextureWeight(g.openingVisibility,point),decoded=(pixels[i]*256+pixels[i+1])/65535;
  close(decoded,quantized(expected),1e-12);
  close(map.weights[p],decoded,3e-8,'Float32 storage is the only CPU/GPU difference');
  assert.equal(Math.round(map.weights[p]*65535),pixels[i]*256+pixels[i+1]);
  assert.equal(pixels[i+2],0);assert.equal(pixels[i+3],255);
  const alpha=Math.max(...g.openingVisibility.regions.map(region=>openingMaskAlpha(region,point)));
  if(alpha===0){close(decoded,g.t,1/65535);ordinaryPixels++}
  if(decoded>g.t+1/65535)biasedPixels++;
 }
 assert.ok(biasedPixels>0,'real public mouth receives a local visibility correction');
 assert.ok(ordinaryPixels>size*size*.9,'whole portrait remains at the ordinary identity coefficient');
});

test('the public closed-to-open mouth selects the visible interior while lips, skin and comparable eyes retain t',()=>{
 const {openingMixMap}=renderer(),g=geometry(.5),size=256,q=size/768,map=openingMixMap(g,size);
 const mouth=g.openingVisibility.regions.find(region=>region.id==='mouth');
 const eyes=g.openingVisibility.regions.filter(region=>region.id.startsWith('eye-'));
 assert.ok(mouth.apertureA<.001&&mouth.apertureB>.1);
 assert.ok(mouth.textureMix>.97);
 for(const eye of eyes)assert.equal(eye.textureMix,g.t);
 let insideMouth=0,insideEyes=0,largestMouthWeight=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const point={x:(x+.5)/q,y:(y+.5)/q},weight=map.weights[y*size+x],mouthAlpha=openingMaskAlpha(mouth,point);
  if(mouthAlpha>0){
   assert.ok(weight>=g.t-1/65535);
   largestMouthWeight=Math.max(largestMouthWeight,weight);insideMouth++;
  }else close(weight,g.t,1/65535,'correction never reaches lips or surrounding skin');
  if(eyes.some(eye=>openingMaskAlpha(eye,point)>0)){
   close(weight,g.t,1/65535);insideEyes++;
  }
 }
 assert.ok(insideMouth>0&&insideEyes>0);
 assert.ok(largestMouthWeight>.97,'the central mouth uses the genuinely observed open texture');
});

test('weight-map cache follows render size, exact progress, photograph revision and topology revision',()=>{
 const {openingMixMap,state,created}=renderer();
 let g=geometry(.5),map=openingMixMap(g,64);
 assert.equal(openingMixMap(g,64),map);assert.equal(created.length,1);
 const expectFresh=(nextGeometry,size)=>{
  const next=openingMixMap(nextGeometry,size);
  assert.notEqual(next,map);assert.notEqual(next.weights,map.weights);
  assert.equal(openingMixMap(nextGeometry,size),next);
  map=next;
 };
 expectFresh(g,96);
 g=geometry(.500001);expectFresh(g,96);
 state.photoVersion++;expectFresh(g,96);
 state.morphTopologyVersion++;expectFresh(g,96);
 assert.equal(created.length,5);
});

test('legacy geometries do not create or reuse a full-morph visibility map',()=>{
 const {openingMixMap,state,created}=renderer();
 assert.equal(openingMixMap({t:.5},128),null);
 assert.equal(openingMixMap({t:.5,openingVisibility:null},128),null);
 assert.equal(created.length,0);
 const map=openingMixMap(geometry(.5),128);
 assert.equal(openingMixMap({t:.5},128),null);
 assert.equal(state.openingMixCache,map,'legacy call does not consume or rewrite the cache');
 assert.equal(created.length,1);
});

test('Canvas blend uses independent spatial weights and preserves alpha instead of hidden source colors',()=>{
 const first=new Uint8ClampedArray([20,80,180,255,255,40,0,0]);
 const second=new Uint8ClampedArray([250,0,30,255,10,170,220,128]);
 const output=new Uint8ClampedArray(8);
 assert.deepEqual([...blendMorphPixels(first,second,.5,output,new Float32Array([0,1]))],
  [20,80,180,255,10,170,220,128]);
 assert.deepEqual([...blendMorphPixels(first,second,.5,output,new Float32Array([1,0]))],
  [250,0,30,255,0,0,0,0]);
 const half=blendMorphPixels(first,second,.5,output,new Float32Array([.5,.5]));
 assert.deepEqual([...half.slice(4)],[10,170,220,64],'transparent red cannot leak into the visible blue source');
 const a=new Uint8ClampedArray(first),expected=new Uint8ClampedArray(8),weights=new Float32Array([.2,.8]);
 blendMorphPixels(a,second,.5,expected,weights);
 blendMorphPixels(a,second,.5,a,weights);
 assert.deepEqual(a,expected,'in-place Canvas pixel buffer keeps per-pixel coefficients');
 const reversed=blendMorphPixels(second,first,.5,new Uint8ClampedArray(8),new Float32Array([.8,.2]));
 for(let i=0;i<8;i++)assert.ok(Math.abs(reversed[i]-expected[i])<=1,'Float32 reversed weights preserve source symmetry');
});
