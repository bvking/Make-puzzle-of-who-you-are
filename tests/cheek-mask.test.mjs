import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localMaskFeatures,outerLipEnvelope} from '../Taquin deux visages interpolés/local-expression.mjs';
import {chinTransition} from '../Taquin deux visages interpolés/chin-transition.mjs';
import {cheekTransitions} from '../Taquin deux visages interpolés/cheek-transition.mjs';

const page=readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('function localExpressionMask('),page.indexOf('function renderLocalExpressions('));
function fixture(){
 const p=Array(478).fill(null);
 for(const [id,x,y] of [[33,230,280],[133,310,280],[362,440,280],[263,520,280],
  [61,300,510],[291,450,510],[13,375,505],[14,375,520],[17,375,540],
  [1,375,400],[152,375,680],[234,190,460],[454,560,460]])p[id]={x,y};
 return p;
}
function render(size,protect=true,withCheeks=true,points=fixture()){
 const draws=[],stack=[],calls=[];let operations=[],gradient=null;
 const ctx={
  save(){stack.push(operations);operations=[]},restore(){operations=stack.pop()},
  translate(...args){operations.push(['translate',...args])},
  rotate(...args){operations.push(['rotate',...args])},
  scale(...args){operations.push(['scale',...args])},
  createRadialGradient(){gradient=[];return{addColorStop(...args){gradient.push(args)}}},
  beginPath(){},arc(){},fill(){draws.push({operations:operations.slice(),stops:gradient.slice()})}
 };
 const buffer={getContext:()=>ctx};
 const bridge=(...args)=>{calls.push(args);return withCheeks?cheekTransitions(...args):[]};
 const mask=new Function('localMaskFeatures','outerLipEnvelope','chinTransition','cheekTransitions','getBuffer','SIZE',
  source+';return localExpressionMask')(localMaskFeatures,outerLipEnvelope,chinTransition,bridge,()=>buffer,768);
 assert.equal(mask(size,points,protect,points,points),buffer);
 assert.equal(stack.length,0,'Canvas state must be restored');
 return {draws,calls,points};
}

test('actual local mask paints rotated cheek gradients at preview and export scales',()=>{
 assert.match(page,/import \{cheekTransitions\} from '\.\/cheek-transition\.mjs'/);
 for(const size of [192,768,1536]){
  const {draws,calls,points}=render(size),fields=cheekTransitions(points),q=size/768;
  assert.equal(calls.length,1);assert.deepEqual(calls[0],[points,points,points]);
  const cheeks=draws.filter(d=>d.operations.some(op=>op[0]==='rotate'));
  assert.equal(cheeks.length,2);
  for(let i=0;i<2;i++){
   const f=fields[i];
   assert.deepEqual(cheeks[i].operations,[['translate',f.x*q,f.y*q],['rotate',f.angle],['scale',f.rx*q,f.ry*q]]);
   assert.deepEqual(cheeks[i].stops,[[0,`rgba(255,255,255,${f.opacity})`],
    [.45,`rgba(255,255,255,${f.opacity*.65})`],[1,'rgba(255,255,255,0)']]);
  }
 }
});

test('cheek addition preserves all existing mouth, nose, chin and lip-seal drawing commands',()=>{
 for(const protect of [true,false]){
  const baseline=render(768,protect,false).draws;
  const added=render(768,protect).draws;
  assert.deepEqual(added.filter(d=>!d.operations.some(op=>op[0]==='rotate')),baseline);
  assert.equal(added.length,baseline.length+2);
 }
});

test('missing cheek landmarks keep the existing local mask usable',()=>{
 const p=fixture();p[234]=null;p[454]=null;
 const {draws}=render(768,true,true,p);
 assert.ok(draws.length>0);
 assert.deepEqual(draws,render(768,true,false,p).draws);
 assert.ok(draws.every(d=>!d.operations.some(op=>op[0]==='rotate')));
});
