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

test('renderer wires chin bridge only into local mask',async()=>{
 const fs=await import('node:fs');
 const page=fs.readFileSync(new URL('../Taquin deux visages interpolés/v15-multiview.html',import.meta.url),'utf8');
 assert.match(page,/import \{chinTransition\} from '\.\/chin-transition\.mjs'/);
 assert.match(page,/const bridge=chinTransition\(points,referencePoints,alignedPoints\)/);
 assert.match(page,/const seam=outerLipEnvelope\(points,referencePoints,alignedPoints\)/);
});

test('degenerate facial proportions do not generate an artificial chin patch',()=>{
 const a=face();
 a[61]={x:380,y:500};a[291]={x:380,y:500};
 assert.equal(chinTransition(a),null);
 const b=face();
 b[152]={...b[17]};
 assert.equal(chinTransition(b),null);
});
test('missing or invalid auxiliary capture does not break valid current geometry',()=>{
 const a=face(40),bad=face();
 bad[61]={x:NaN,y:500};
 const result=chinTransition(a,bad,null);
 assert.ok(result&&Number.isFinite(result.x)&&Number.isFinite(result.y));
});

test('closed current mouth stays subtle even if target has a wide-open mouth',()=>{
 const closed=face(2),open=face(70);
 const closedBridge=chinTransition(closed,closed,open);
 const openBridge=chinTransition(open,closed,open);
 assert.ok(closedBridge.opacity<openBridge.opacity);
 assert.ok(closedBridge.ry<openBridge.ry);
 assert.equal(closedBridge.maxOpening,openBridge.maxOpening);
});
