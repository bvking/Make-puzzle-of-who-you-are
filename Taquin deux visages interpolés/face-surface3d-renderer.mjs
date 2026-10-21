/**
 * WebGL 1 renderer for the estimated facial surface, using a real depth buffer.
 * Positions are orthographic NDC (x right, y up, smaller z nearer the camera),
 * normals face the camera (negative z frontally), and all UVs use image y down.
 * Textures are projected from both input portraits; no hidden profile is made up.
 */
export class Surface3DRenderError extends Error {
  constructor(code, message) { super(message); this.name='Surface3DRenderError'; this.code=code; }
}

const VERTEX_SOURCE=`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUvA;
attribute vec2 aUvB;
attribute vec2 aMixUv;
attribute float aCavity;
varying mediump vec3 vNormal;
varying mediump vec2 vUvA;
varying mediump vec2 vUvB;
varying mediump vec2 vMixUv;
varying mediump float vCavity;
void main(){
  gl_Position=vec4(aPosition,1.0);
  vNormal=aNormal;
  vUvA=aUvA;vUvB=aUvB;vMixUv=aMixUv;vCavity=aCavity;
}`;

const FRAGMENT_SOURCE=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTextureA;
uniform sampler2D uTextureB;
uniform sampler2D uMixMap;
uniform float uMix;
uniform float uHasMixMap;
uniform float uClay;
varying mediump vec3 vNormal;
varying mediump vec2 vUvA;
varying mediump vec2 vUvB;
varying mediump vec2 vMixUv;
varying mediump float vCavity;
vec3 toLinear(vec3 c){
  return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
vec3 toSrgb(vec3 c){
  c=clamp(c,vec3(0.0),vec3(1.0));
  return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));
}
void main(){
  vec3 color;
  if(uClay>0.5){
    vec3 normal=normalize(vNormal);
    vec3 key=normalize(vec3(-0.45,0.65,-1.0));
    vec3 fill=normalize(vec3(0.7,0.1,-1.0));
    float illumination=0.42+0.45*max(dot(normal,key),0.0)+0.13*max(dot(normal,fill),0.0);
    color=vec3(0.56,0.60,0.65)*illumination;
    color=mix(color,vec3(0.015,0.017,0.020),clamp(vCavity,0.0,1.0));
  }else{
    float amount=uMix;
    if(uHasMixMap>0.5){
      // RG16 decoder stays in range even on a mediump-only WebGL 1 device.
      vec2 encoded=texture2D(uMixMap,vMixUv).rg;
      amount=dot(encoded,vec2(256.0/257.0,1.0/257.0));
    }
    vec4 a=texture2D(uTextureA,vUvA),b=texture2D(uTextureB,vUvB);
    float weightA=a.a*(1.0-amount),weightB=b.a*amount;
    color=toLinear(a.rgb)*weightA+toLinear(b.rgb)*weightB+vec3(1.0-weightA-weightB);
  }
  gl_FragColor=vec4(toSrgb(color),1.0);
}`;

const fail=(code,message)=>{throw new Surface3DRenderError(code,message)};
const finiteArray=(array,length)=>array instanceof Float32Array&&array.length===length&&array.every(Number.isFinite);
const equalArray=(first,second)=>first?.length===second.length&&second.every((value,index)=>value===first[index]);
const sourceSize=source=>[source?.width||source?.naturalWidth||source?.videoWidth||0,source?.height||source?.naturalHeight||source?.videoHeight||0];

function validateGeometry(geometry){
  const positions=geometry?.positions,vertices=positions?.length/3;
  if(!(positions instanceof Float32Array)||!Number.isInteger(vertices)||vertices<3||vertices>65535||!positions.every(Number.isFinite))fail('GEOMETRY','Surface 3D : positions invalides.');
  if(!finiteArray(geometry.normals,vertices*3)||!finiteArray(geometry.uvA,vertices*2)||!finiteArray(geometry.uvB,vertices*2))fail('GEOMETRY','Surface 3D : normales ou coordonnées de texture invalides.');
  for(let i=0;i<geometry.normals.length;i+=3)if(Math.hypot(...geometry.normals.subarray(i,i+3))<1e-8)fail('GEOMETRY','Surface 3D : normale nulle.');
  if(geometry.cavity!=null&&(!finiteArray(geometry.cavity,vertices)||geometry.cavity.some(value=>value<0||value>1)))fail('GEOMETRY','Surface 3D : cavité invalide.');
  if(geometry.mixUV!=null&&!finiteArray(geometry.mixUV,vertices*2))fail('GEOMETRY','Surface 3D : coordonnées de visibilité invalides.');
  if(!(geometry.indices instanceof Uint16Array)||!geometry.indices.length||geometry.indices.length%3||geometry.indices.some(index=>index>=vertices))fail('GEOMETRY','Surface 3D : topologie invalide.');
  if(!Number.isFinite(geometry.textureMix)||geometry.textureMix<0||geometry.textureMix>1)fail('GEOMETRY','Surface 3D : mélange invalide.');
}

function compileShader(gl,type,source){
  const shader=gl.createShader(type);if(!shader)fail('RESOURCE','Surface 3D : shader indisponible.');
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||'Compilation du shader impossible.';gl.deleteShader(shader);fail('SHADER',message);
  }
  return shader;
}

function assertContext(gl){
  if(gl.isContextLost())fail('CONTEXT_LOST','Contexte 3D perdu : attends sa restauration ou recharge la page.');
  const error=gl.getError();if(error!==gl.NO_ERROR)fail('WEBGL',`Surface 3D : erreur WebGL 0x${error.toString(16)}.`);
}

function release(gl,resources){
  if(!resources||gl.isContextLost())return;
  for(const buffer of Object.values(resources.buffers||{}))if(buffer)gl.deleteBuffer(buffer);
  for(const texture of Object.values(resources.textures||{}))if(texture)gl.deleteTexture(texture);
  if(resources.program)gl.deleteProgram(resources.program);
}

function createResources(gl){
  const resources={buffers:{},textures:{},locations:{},cached:{}};
  let vertex=null,fragment=null;
  try{
    vertex=compileShader(gl,gl.VERTEX_SHADER,VERTEX_SOURCE);fragment=compileShader(gl,gl.FRAGMENT_SHADER,FRAGMENT_SOURCE);
    const program=resources.program=gl.createProgram();if(!program)fail('RESOURCE','Surface 3D : programme indisponible.');
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))fail('SHADER',gl.getProgramInfoLog(program)||'Assemblage du programme 3D impossible.');
    for(const name of ['Position','Normal','UvA','UvB','MixUv','Cavity']){
      resources.buffers[name]=gl.createBuffer();resources.locations[name]=gl.getAttribLocation(program,`a${name}`);
      if(!resources.buffers[name]||resources.locations[name]<0)fail('RESOURCE',`Surface 3D : attribut ${name} indisponible.`);
    }
    resources.buffers.Index=gl.createBuffer();if(!resources.buffers.Index)fail('RESOURCE','Surface 3D : topologie indisponible.');
    for(const [index,name] of ['TextureA','TextureB','MixMap'].entries()){
      const texture=resources.textures[name]=gl.createTexture();if(!texture)fail('RESOURCE','Surface 3D : texture indisponible.');
      gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
      textureParameters(gl);
      // All samplers are complete, including when the clay material is active.
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    }
    for(const name of ['TextureA','TextureB','MixMap','Mix','HasMixMap','Clay']){
      resources.locations[name]=gl.getUniformLocation(program,`u${name}`);
      if(resources.locations[name]==null)fail('RESOURCE',`Surface 3D : uniforme ${name} indisponible.`);
    }
    assertContext(gl);return resources;
  }catch(error){release(gl,resources);throw error}
  finally{if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment)}
}

function textureParameters(gl){
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
}

function uploadTexture(gl,texture,source,unit){
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  textureParameters(gl);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
}

function uploadAttribute(gl,resources,name,data,dimensions,{stable=false}={}){
  gl.bindBuffer(gl.ARRAY_BUFFER,resources.buffers[name]);
  if(!stable||!equalArray(resources.cached[name],data)){
    gl.bufferData(gl.ARRAY_BUFFER,data,stable?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);
    if(stable)resources.cached[name]=data.slice();
  }
  gl.enableVertexAttribArray(resources.locations[name]);gl.vertexAttribPointer(resources.locations[name],dimensions,gl.FLOAT,false,0,0);
}

/**
 * Create lazily: construction itself needs neither a DOM nor a GPU.
 * render({geometry,sources:[A,B],size,material='texture',textureVersion,mixMap})
 * returns an opaque canvas. textureVersion must change when source pixels change;
 * omit it to re-upload every call. mixMap is optional {canvas,key} with the app's
 * target-space RG16 visibility weights; geometry.mixUV follows that map in 3D.
 * Failures are explicit Surface3DRenderError exceptions, never a hidden 2D mode.
 */
export function createSurface3DRenderer({canvasFactory,onContextChange}={}){
  let canvas=null,gl=null,resources=null,lost=false,disposed=false;
  const onLost=event=>{event.preventDefault();lost=true;resources=null;onContextChange?.({lost:true})};
  const onRestored=()=>{lost=false;resources=null;onContextChange?.({lost:false})};
  function initialize(){
    if(disposed)fail('DISPOSED','Le rendu 3D a été libéré.');
    if(lost)fail('CONTEXT_LOST','Contexte 3D perdu : attends sa restauration ou recharge la page.');
    if(!canvas){
      const factory=canvasFactory||(()=>globalThis.document?.createElement('canvas'));
      canvas=factory();if(!canvas)fail('UNAVAILABLE','WebGL 3D indisponible dans cet environnement.');
      const attributes={alpha:false,depth:true,stencil:false,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true};
      try{gl=canvas.getContext('webgl',attributes)||canvas.getContext('experimental-webgl',attributes)}catch(error){fail('UNAVAILABLE',`WebGL 3D indisponible : ${error.message}`)}
      if(!gl)fail('UNAVAILABLE','WebGL 3D indisponible sur cet appareil.');
      canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
    }
    if(!gl)fail('UNAVAILABLE','WebGL 3D indisponible sur cet appareil.');
    if(gl.isContextLost())fail('CONTEXT_LOST','Contexte 3D perdu : attends sa restauration ou recharge la page.');
    if(!resources)resources=createResources(gl);
  }
  return{
    get canvas(){return canvas},
    get lost(){return lost},
    render({geometry,sources,size,material='texture',textureVersion,mixMap=null}={}){
      validateGeometry(geometry);
      if(!Number.isInteger(size)||size<1||size>8192)fail('SIZE','Surface 3D : taille de rendu invalide.');
      if(material!=='texture'&&material!=='clay')fail('MATERIAL','Surface 3D : matériau inconnu.');
      if(material==='texture'&&(!Array.isArray(sources)||sources.length!==2||sources.some(source=>sourceSize(source).some(dimension=>!Number.isFinite(dimension)||dimension<=0))))fail('TEXTURES','Surface 3D : les deux portraits sont requis.');
      if(mixMap&&(!mixMap.canvas||sourceSize(mixMap.canvas).some(dimension=>dimension<=0)))fail('TEXTURES','Surface 3D : carte de visibilité invalide.');
      initialize();
      if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size}
      gl.viewport(0,0,size,size);gl.useProgram(resources.program);
      uploadAttribute(gl,resources,'Position',geometry.positions,3);uploadAttribute(gl,resources,'Normal',geometry.normals,3);
      if(!geometry.cavity&&resources.cached.emptyCavity?.length!==geometry.positions.length/3)resources.cached.emptyCavity=new Float32Array(geometry.positions.length/3);
      uploadAttribute(gl,resources,'Cavity',geometry.cavity||resources.cached.emptyCavity,1,{stable:true});
      uploadAttribute(gl,resources,'UvA',geometry.uvA,2,{stable:true});uploadAttribute(gl,resources,'UvB',geometry.uvB,2,{stable:true});
      let mixUV=geometry.mixUV;
      if(!mixUV){mixUV=new Float32Array(geometry.positions.length/3*2);for(let i=0;i<mixUV.length/2;i++){mixUV[i*2]=geometry.positions[i*3]*.5+.5;mixUV[i*2+1]=.5-geometry.positions[i*3+1]*.5}}
      uploadAttribute(gl,resources,'MixUv',mixUV,2,{stable:true});
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,resources.buffers.Index);
      if(!equalArray(resources.cached.Index,geometry.indices)){gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);resources.cached.Index=geometry.indices.slice()}
      if(material==='texture'){
        const sizes=sources.flatMap(sourceSize),cache=resources.cached;
        if(textureVersion==null||cache.textureVersion!==textureVersion||cache.sources?.some((source,index)=>source!==sources[index])||!cache.sources||!equalArray(cache.sourceSizes,sizes)){
          uploadTexture(gl,resources.textures.TextureA,sources[0],0);uploadTexture(gl,resources.textures.TextureB,sources[1],1);
          cache.textureVersion=textureVersion;cache.sources=sources.slice();cache.sourceSizes=sizes;
        }
      }
      if(mixMap&&(mixMap.key==null||resources.cached.mixKey!==mixMap.key||resources.cached.mixSource!==mixMap.canvas)){
        uploadTexture(gl,resources.textures.MixMap,mixMap.canvas,2);resources.cached.mixKey=mixMap.key;resources.cached.mixSource=mixMap.canvas;
      }
      // Rebind each sampler even when cached, so uploads cannot change its unit.
      for(const [unit,name] of ['TextureA','TextureB','MixMap'].entries()){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,resources.textures[name]);gl.uniform1i(resources.locations[name],unit)}
      gl.uniform1f(resources.locations.Mix,geometry.textureMix);gl.uniform1f(resources.locations.HasMixMap,mixMap&&material==='texture'?1:0);gl.uniform1f(resources.locations.Clay,material==='clay'?1:0);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
      gl.clearColor(1,1,1,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      assertContext(gl);gl.drawElements(gl.TRIANGLES,geometry.indices.length,gl.UNSIGNED_SHORT,0);gl.flush();assertContext(gl);
      return canvas;
    },
    dispose(){
      if(disposed)return;disposed=true;
      if(canvas){canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored)}
      if(gl)release(gl,resources);resources=null;
    }
  };
}
