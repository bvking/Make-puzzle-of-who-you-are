import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySimilarity, weightedFit, robustStableAlignment, STABLE_ANCHORS } from '../Taquin deux visages interpolés/handheld-alignment.mjs';

const SIZE=768;
function inputPair(){
 const first=Array.from({length:478},(_,i)=>({x:.5+.08*Math.cos(i*.13),y:.48+.14*Math.sin(i*.13)}));
 const landmarks={
 33:[.34,.40],133:[.42,.41],362:[.58,.41],263:[.66,.40],
 168:[.50,.45],6:[.50,.47],197:[.50,.49],195:[.50,.51],
 4:[.50,.56],1:[.50,.58],5:[.50,.55],98:[.46,.61],
 327:[.54,.61],94:[.50,.60],2:[.50,.61],
 13:[.50,.72],14:[.50,.74],152:[.50,.88]
 };
 for(const [id,[x,y]] of Object.entries(landmarks))first[+id]={x,y};
 const angle=.16,scale=1.13,trans={a:scale*Math.cos(angle),b:scale*Math.sin(angle),tx:34,ty:-27};
 // Generate B so that its forward 2D camera correction is A.
 const second=first.map(p=>{
  const dx=p.x*SIZE-trans.tx,dy=p.y*SIZE-trans.ty,den=trans.a**2+trans.b**2;
  return {x:(trans.a*dx+trans.b*dy)/den/SIZE,y:(-trans.b*dx+trans.a*dy)/den/SIZE};
 });
 return {first,second,trans};
}
const close=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('weighted 2-D similarity maps source point coordinates to reference',()=>{
 const source=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];
 const t={a:1.12,b:.19,tx:31,ty:-20};
 const dest=source.map(p=>applySimilarity(p,t));
 const fit=weightedFit(source,dest,[2,3,1]);
 close(fit.a,t.a,1e-9);close(fit.b,t.b,1e-9);
 close(fit.tx,t.tx,1e-9);close(fit.ty,t.ty,1e-9);
});

test('robust fitting recovers handheld roll, zoom and translation without using mouth and jaw',()=>{
 const {first,second,trans}=inputPair();
 second[13].y+=.10;second[14].y+=.19;second[152].y+=.08;
 const fit=robustStableAlignment(first,second,SIZE);
 assert.equal(fit.reliable,true);
 assert.ok(STABLE_ANCHORS.every(([id])=>![13,14,152,61,291].includes(id)));
 close(fit.scale,Math.hypot(trans.a,trans.b),.02);
 close(fit.roll,.16,.02);
 close(fit.tx,34,3);close(fit.ty,-27,3);
 assert.ok(fit.normalizedRms<.05);
});

test('single unreliable nose-side outlier does not overturn eye/nose alignment',()=>{
 const {first,second,trans}=inputPair();
 second[98]={x:second[98].x+.4,y:second[98].y-.3};
 const fit=robustStableAlignment(first,second,SIZE);
 assert.ok(fit);
 assert.ok(Math.abs(fit.roll-.16)<.06);
 assert.ok(Math.abs(fit.scale-Math.hypot(trans.a,trans.b))<.07);
});

test('unrecoverable or insufficient anchor patterns are explicitly rejected',()=>{
 const {first,second}=inputPair();
 assert.equal(robustStableAlignment(null,null,SIZE),null);
 assert.equal(robustStableAlignment(first.slice(0,100),second.slice(0,100),SIZE),null);
 assert.equal(weightedFit([{x:0,y:0}],[],[1]),null);
});

test('stabilized mode warps UV from unmodified captured B, with original A as unchanged background',()=>{
 const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
 assert.match(page,/import \{applySimilarity,robustStableAlignment\} from '\.\/handheld-alignment\.mjs'/);
 assert.match(page,/const aligned=second\.map\(p=>applySimilarity\(p,fit\)\)/);
 assert.match(page,/raw1:first,raw2:second,alignedSecond:stableSecond/);
 assert.match(page,/target:g\.raw1\.map\(\(p,i\)=>lerpPoint\(p,g\.alignedSecond\[i\],v\.a\)\)/);
 assert.match(page,/function renderStabilizedFace\(canvas,v\)/);
 assert.match(page,/const geometry=stabilizedGeometry\(v\),ctx=drawBackground\(canvas\)/);
 assert.match(page,/mctx\.globalCompositeOperation='destination-in'/);
 assert.match(page,/ctx\.drawImage\(masked,0,0\)/);
 assert.match(page,/state\.mode==='stabilized'\?stabilizedGeometry\(v\)/);
 for(const fraction of [25,50,75])assert.match(page,new RegExp('id="diagnostic'+fraction+'"'));
});

test('stabilized animation keeps its own mode instead of switching to regions',()=>{
 const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
 const from=page.indexOf('function animationFrame(){'),to=page.indexOf('function automaticMotionReduced()',from);
 assert.ok(from>0&&to>from);
 const code=page.slice(from,to);
 const state={mode:'stabilized',animation:{baseControls:{a:.5,x:0,y:0,s:1,r:0},phase:1,ramp:1}};
 const snapshot=(mode,values,regions)=>({mode,values,regions});
 const frame=new Function('state','animationSettings','smoothstep','oscillatedBounded','animationSnapshot',code+';return animationFrame')(
  state,()=>({amplitude:.35}),x=>x*x*(3-2*x),(base,amount,wave,min,max)=>Math.min(max,Math.max(min,base+amount*wave)),snapshot
 )();
 assert.equal(frame.mode,'stabilized');
 assert.equal(frame.regions,null);
 assert.ok(frame.values.a>0&&frame.values.a<1);
 assert.match(page,/state\.mode==='stabilized'&&!!stabilizedGeometry/);
 assert.match(page,/state\.mode==='stabilized'\?\(state\.webgl\?\.failed\?1000\/8:1000\/15\)/);
});
