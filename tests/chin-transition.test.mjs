import test from 'node:test';
import assert from 'node:assert/strict';
import {chinTransition} from '../Taquin deux visages interpolés/chin-transition.mjs';
function face(gap=2){
 const p=Array.from({length:478},()=>({x:380,y:480}));
 p[61]={x:320,y:500};p[291]={x:440,y:500};
 p[13]={x:380,y:500};p[14]={x:380,y:500+gap};
 p[17]={x:380,y:540+gap};p[152]={x:385,y:670+gap};
 return p;
}
test('chin transition grows with mouth opening without leaving lower face',()=>{
 const a=face(2),b=face(70);
 const closed=chinTransition(a,a,b),opened=chinTransition(b,a,b);
 assert.ok(closed&&opened);
 assert.ok(opened.y>b[17].y&&opened.y<b[152].y);
 assert.ok(opened.opacity>=closed.opacity);
 assert.ok(opened.rx>0&&opened.ry>0);
});
test('invalid landmarks do not yield a chin bridge',()=>{
 assert.equal(chinTransition([]),null);
 assert.equal(chinTransition(null),null);
});
