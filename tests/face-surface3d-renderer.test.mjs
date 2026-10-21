import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurface3DRenderer,Surface3DRenderError} from '../Taquin deux visages interpolés/face-surface3d-renderer.mjs';

function fixture(){
 const calls=[],events=new Map();let id=0,lost=false;
 const constants=['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','TEXTURE0','TEXTURE_2D','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','RGBA','UNSIGNED_BYTE','ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER','DYNAMIC_DRAW','STATIC_DRAW','FLOAT','UNPACK_FLIP_Y_WEBGL','UNPACK_PREMULTIPLY_ALPHA_WEBGL','UNPACK_COLORSPACE_CONVERSION_WEBGL','NONE','DEPTH_TEST','LESS','CULL_FACE','BLEND','TRIANGLES','UNSIGNED_SHORT'];
 const gl=Object.fromEntries(constants.map((name,index)=>[name,index+10]));
 Object.assign(gl,{NO_ERROR:0,COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,isContextLost:()=>lost,getError:()=>0,
  getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:(_p,name)=>['aPosition','aNormal','aUvA','aUvB','aMixUv','aCavity'].indexOf(name),getUniformLocation:(_p,name)=>name,
  getShaderInfoLog:()=>'',getProgramInfoLog:()=>''});
 for(const method of ['createShader','createProgram','createBuffer','createTexture'])gl[method]=()=>({id:id++,kind:method});
 for(const method of ['shaderSource','compileShader','deleteShader','attachShader','linkProgram','activeTexture','bindTexture','texParameteri','texImage2D','deleteBuffer','deleteTexture','deleteProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','pixelStorei','viewport','useProgram','uniform1i','uniform1f','enable','depthFunc','depthMask','disable','clearColor','clearDepth','clear','drawElements','flush'])gl[method]=(...args)=>calls.push({method,args:args.map(value=>ArrayBuffer.isView(value)?value.slice():value)});
 const canvas={width:0,height:0,getContext(type,attributes){calls.push({method:'getContext',args:[type,attributes]});return gl},addEventListener:(name,handler)=>events.set(name,handler),removeEventListener:(name,handler)=>{if(events.get(name)===handler)events.delete(name)}};
 let created=0;const statuses=[];
 const renderer=createSurface3DRenderer({canvasFactory(){created++;return canvas},onContextChange:state=>statuses.push(state)});
 const geometry={positions:new Float32Array([-.5,-.5,.1,.5,-.5,.1,0,.5,-.2]),normals:new Float32Array([0,0,-1,0,0,-1,0,0,-1]),uvA:new Float32Array([0,1,1,1,.5,0]),uvB:new Float32Array([0,1,1,1,.5,0]),indices:new Uint16Array([0,1,2]),textureMix:.5};
 const sources=[{width:2,height:2,name:'A'},{width:2,height:2,name:'B'}];
 return{gl,canvas,calls,events,renderer,geometry,sources,statuses,get created(){return created},setLost(value){lost=value}};
}
const count=(calls,method)=>calls.filter(call=>call.method===method).length;
const errorCode=code=>error=>error instanceof Surface3DRenderError&&error.code===code;

test('3D render is lazy and uses a real opaque white depth buffer with XYZ attributes',()=>{
 const d=fixture();assert.equal(d.created,0);assert.equal(d.renderer.canvas,null);
 assert.equal(d.renderer.render({...d,size:128}),d.canvas);assert.equal(d.created,1);
 assert.equal(d.calls.find(call=>call.method==='getContext').args[1].depth,true);
 assert.equal(d.calls.find(call=>call.method==='getContext').args[1].alpha,false);
 assert.ok(d.calls.some(call=>call.method==='enable'&&call.args[0]===d.gl.DEPTH_TEST));
 assert.deepEqual(d.calls.find(call=>call.method==='clearColor').args,[1,1,1,1]);
 assert.deepEqual(d.calls.find(call=>call.method==='clearDepth').args,[1]);
 assert.deepEqual(d.calls.find(call=>call.method==='depthFunc').args,[d.gl.LESS]);
 assert.deepEqual(d.calls.find(call=>call.method==='clear').args,[d.gl.COLOR_BUFFER_BIT|d.gl.DEPTH_BUFFER_BIT]);
 assert.ok(d.calls.some(call=>call.method==='vertexAttribPointer'&&call.args[0]===0&&call.args[1]===3));
 assert.ok(d.calls.some(call=>call.method==='vertexAttribPointer'&&call.args[0]===1&&call.args[1]===3));
 assert.deepEqual(d.calls.find(call=>call.method==='drawElements').args,[d.gl.TRIANGLES,3,d.gl.UNSIGNED_SHORT,0]);
 assert.ok(d.calls.filter(call=>call.method==='pixelStorei'&&call.args[0]===d.gl.UNPACK_FLIP_Y_WEBGL).every(call=>call.args[1]===false));
});

test('unchanged textures and topology stay on GPU, while changed contents invalidate cached arrays',()=>{
 const d=fixture(),options={...d,size:128,textureVersion:1};
 d.renderer.render(options);const uploads=count(d.calls,'texImage2D'),buffers=count(d.calls,'bufferData');
 d.renderer.render(options);assert.equal(count(d.calls,'texImage2D'),uploads);assert.equal(count(d.calls,'bufferData')-buffers,2,'only moving positions and normals upload');
 d.geometry.indices.reverse();d.renderer.render(options);assert.equal(count(d.calls,'bufferData')-buffers,5,'mutating the same index array also uploads topology');
 d.renderer.render({...options,textureVersion:2});assert.equal(count(d.calls,'texImage2D'),uploads+2);
 d.renderer.render({...options,sources:[{width:2,height:2},d.sources[1]]});assert.equal(count(d.calls,'texImage2D'),uploads+4);
 d.renderer.render({...options,textureVersion:undefined});assert.equal(count(d.calls,'texImage2D'),uploads+6,'no version deliberately disables the texture cache');
});

test('clay works without photos and optional cavity material does not modify texture blending',()=>{
 const d=fixture();d.geometry.cavity=new Float32Array([0,.5,1]);
 d.renderer.render({geometry:d.geometry,size:128,material:'clay'});
 assert.equal(count(d.calls,'texImage2D'),3,'only complete one-pixel sampler defaults');
 assert.ok(d.calls.some(call=>call.method==='vertexAttribPointer'&&call.args[0]===5&&call.args[1]===1));
 assert.ok(d.calls.some(call=>call.method==='uniform1f'&&call.args[0]==='uClay'&&call.args[1]===1));
 const fragment=d.calls.find(call=>call.method==='shaderSource'&&call.args[1].includes('precision highp'))?.args[1];
 assert.ok(fragment);assert.match(fragment,/if\(uClay>0\.5\)[\s\S]*vCavity[\s\S]*}else/);
 assert.doesNotMatch(fragment.slice(fragment.indexOf('}else{')),/vCavity/);
 assert.match(fragment,/toLinear\(a\.rgb\)/);assert.match(fragment,/gl_FragColor=vec4\(toSrgb\(color\),1\.0\)/);
});

test('visibility map is optional, cached by key and source, and follows supplied frontal UVs',()=>{
 const d=fixture(),map={canvas:{width:128,height:128},key:'position-50'};
 d.geometry.mixUV=new Float32Array([0,1,1,1,.5,0]);
 d.renderer.render({...d,size:128,mixMap:map,textureVersion:1});const uploads=count(d.calls,'texImage2D');
 assert.ok(d.calls.some(call=>call.method==='uniform1f'&&call.args[0]==='uHasMixMap'&&call.args[1]===1));
 assert.ok(d.calls.some(call=>call.method==='bufferData'&&call.args[1] instanceof Float32Array&&call.args[1].length===6&&call.args[1].every((x,i)=>x===d.geometry.mixUV[i])));
 d.renderer.render({...d,size:128,mixMap:map,textureVersion:1});assert.equal(count(d.calls,'texImage2D'),uploads);
 d.renderer.render({...d,size:128,mixMap:{...map,key:'position-51'},textureVersion:1});assert.equal(count(d.calls,'texImage2D'),uploads+1);
 d.renderer.render({...d,size:128,textureVersion:1});
 assert.equal(d.calls.filter(call=>call.method==='uniform1f'&&call.args[0]==='uHasMixMap').at(-1).args[1],0);
});

test('invalid geometry fails before allocating WebGL and never returns a fake 2D frame',()=>{
 const d=fixture();
 for(const geometry of [null,{...d.geometry,positions:new Float32Array([NaN,0,0])},{...d.geometry,normals:new Float32Array(9)},{...d.geometry,indices:new Uint16Array([0,1,9])},{...d.geometry,textureMix:2},{...d.geometry,cavity:new Float32Array([0,0,NaN])}])assert.throws(()=>d.renderer.render({geometry,sources:d.sources,size:128}),errorCode('GEOMETRY'));
 assert.equal(d.created,0);
 assert.throws(()=>d.renderer.render({geometry:d.geometry,size:128}),errorCode('TEXTURES'));
 assert.throws(()=>d.renderer.render({...d,size:0}),errorCode('SIZE'));
 assert.throws(()=>d.renderer.render({...d,size:128,material:'unknown'}),errorCode('MATERIAL'));
 assert.equal(d.created,0);
});

test('context loss is explicit, restoration rebuilds all resources, and dispose is permanent',()=>{
 const d=fixture(),options={...d,size:128,textureVersion:1};d.renderer.render(options);const uploads=count(d.calls,'texImage2D');let prevented=false;
 d.setLost(true);d.events.get('webglcontextlost')({preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(d.renderer.lost,true);assert.throws(()=>d.renderer.render(options),errorCode('CONTEXT_LOST'));
 d.setLost(false);d.events.get('webglcontextrestored')();d.renderer.render(options);
 assert.equal(count(d.calls,'texImage2D'),uploads+5);assert.deepEqual(d.statuses,[{lost:true},{lost:false}]);
 d.renderer.dispose();assert.equal(d.events.size,0);assert.equal(count(d.calls,'deleteBuffer'),7);assert.equal(count(d.calls,'deleteTexture'),3);assert.equal(count(d.calls,'deleteProgram'),1);
 assert.throws(()=>d.renderer.render(options),errorCode('DISPOSED'));
 d.renderer.dispose();assert.equal(count(d.calls,'deleteProgram'),1);
});
