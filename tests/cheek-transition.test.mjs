import test from 'node:test';
import assert from 'node:assert/strict';
import {cheekTransitions} from '../Taquin deux visages interpolés/cheek-transition.mjs';

// Deliberately artificial points; never derived from a capture or a scan.
function face(gap=4){
 const p=Array(478).fill(null);
 const features={33:[230,280],133:[310,280],362:[440,280],263:[520,280],
  145:[270,300],374:[480,300],61:[300,510],291:[450,510],
  13:[375,505],14:[375,505+gap],152:[375,680],234:[190,460],454:[560,460]};
 for(const [id,[x,y]] of Object.entries(features))p[id]={x,y};
 return p;
}
const mapFace=(p,fn)=>p.map(point=>point&&fn(point));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('cheek bridges soften both mouth sides while staying inside the cheek outline and below eyes',()=>{
 const p=face(),fields=cheekTransitions(p);
 assert.equal(fields.length,2);
 assert.ok(fields[0].x<p[61].x&&fields[1].x>p[291].x);
 for(const f of fields){
  assert.ok(f.opacity>=.20&&f.opacity<=.26);
  assert.ok(f.y-f.ry>=300+210*.18);
  assert.ok(f.y+f.ry<p[152].y);
  assert.ok(f.x-f.rx>p[234].x&&f.x+f.rx<p[454].x);
 }
 near(fields[0].rx,fields[1].rx);near(fields[0].ry,fields[1].ry);
});

test('roll, translation, scaling and mirrored captures preserve anatomical bounds',()=>{
 const p=face(),base=cheekTransitions(p);
 for(const angle of [-1.1,-.3,.4,1.2])for(const scale of [.4,1,2])for(const mirror of [-1,1]){
  const c=Math.cos(angle),s=Math.sin(angle);
  const transform=({x,y})=>({x:80+scale*(mirror*x*c-y*s),y:-35+scale*(mirror*x*s+y*c)});
  const fields=cheekTransitions(mapFace(p,transform));
  assert.equal(fields.length,2);
  for(let i=0;i<2;i++){
   const expected=transform(base[i]);
   near(fields[i].x,expected.x);near(fields[i].y,expected.y);
   near(fields[i].rx,base[i].rx*scale);near(fields[i].ry,base[i].ry*scale);
   near(fields[i].opacity,base[i].opacity);
  }
 }
});

test('all poses protect the eye band without expanding a closed current mouth',()=>{
 const p=face(),open=face(95),before=structuredClone([p,open]);
 assert.deepEqual(cheekTransitions(p,p,open),cheekTransitions(p));
 const raised=face();
 for(const id of [33,133,362,263,145,374])raised[id].y+=180;
 for(const field of cheekTransitions(p,p,raised))assert.ok(field.y-field.ry>=480+210*.18);
 assert.equal(cheekTransitions(p,p,raised).length,2);
 const obstructed=face();
 for(const id of [33,133,362,263,145,374])obstructed[id].y+=250;
 assert.deepEqual(cheekTransitions(p,p,obstructed),[]);
 assert.deepEqual([p,open],before);
});

test('opening strength is bounded, continuous and uses only current expression',()=>{
 let previous=.20;
 for(let gap=0;gap<=150;gap++){
  const fields=cheekTransitions(face(gap),face(0),face(150));
  assert.equal(fields.length,2);
  assert.ok(fields[0].opacity>=previous-1e-12&&fields[0].opacity<=.26);
  assert.ok(fields[0].opacity-previous<.002);
  previous=fields[0].opacity;
 }
});

test('asymmetric smile has independent cheek heights and missing side data is skipped',()=>{
 const p=face();p[61].y-=35;
 const fields=cheekTransitions(p);
 assert.equal(fields.length,2);assert.ok(fields[0].y<fields[1].y);
 p[234]=null;
 assert.deepEqual(cheekTransitions(p).map(f=>f.name),['rightCheek']);
 p[454]={x:NaN,y:460};assert.deepEqual(cheekTransitions(p),[]);
});

test('invalid or collapsed current geometry is skipped; invalid auxiliary data is ignored',()=>{
 for(const p of [null,[],{},face().map(()=>({x:0,y:0}))])assert.deepEqual(cheekTransitions(p),[]);
 for(const id of [33,133,362,263,13,14,61,291,152]){
  const p=face();p[id]={x:NaN,y:400};assert.deepEqual(cheekTransitions(p),[]);
  assert.deepEqual(cheekTransitions(face(),p,[]),cheekTransitions(face()));
 }
 const p=face();p[291]={...p[61]};assert.deepEqual(cheekTransitions(p),[]);
 const inverted=face();inverted[152].y=450;assert.deepEqual(cheekTransitions(inverted),[]);
});
