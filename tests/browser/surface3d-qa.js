// Injected into the app module. Assets are public unless the user explicitly
// imports a local archive in ?qaManual=1; there is never a private HTTP fetch.
const s3qaManual=new URLSearchParams(location.search).get('qaManual')==='1';
const s3qaBox=document.createElement('section');s3qaBox.id='surface3dQa';s3qaBox.style='padding:16px;background:#18202b;color:#fff';
const s3qaTitle=document.createElement('h2');s3qaTitle.textContent='Validation graphique de la surface 3D estimée';
const s3qaNote=document.createElement('p');s3qaNote.textContent='Surface faciale ouverte issue des XYZ relatifs ; argile, photos projetées et inspection à 20°/10°. Les coins blancs, la profondeur et la symétrie numérique ne prouvent pas le naturel visuel. Aucun crâne, cheveux ou profil caché n’est reconstruit.';
const s3qaRun=document.createElement('button');s3qaRun.id='surface3dQaRun';s3qaRun.textContent=s3qaManual?'Tester les scans importés':'Relancer la validation publique';
const s3qaStatus=document.createElement('pre');s3qaStatus.id='surface3dQaResult';s3qaStatus.style='white-space:pre-wrap';s3qaStatus.textContent=s3qaManual?'Importer un ZIP local avec le bouton de l’application, puis lancer les tests.':'Chargement des portraits publics…';
const s3qaDetails=document.createElement('details'),s3qaSummary=document.createElement('summary'),s3qaMetrics=document.createElement('pre');s3qaSummary.textContent='Mesures techniques';s3qaMetrics.id='surface3dQaMetrics';s3qaMetrics.style='white-space:pre-wrap';s3qaDetails.append(s3qaSummary,s3qaMetrics);
s3qaBox.append(s3qaTitle,s3qaNote,s3qaRun,s3qaStatus,s3qaDetails);document.body.prepend(s3qaBox);
const s3qaSize=384,s3qaPositions=[0,.25,.5,.75,1],s3qaVariants=[{id:'clay',material:'clay',label:'Argile · face'},{id:'texture',material:'texture',label:'Photos · face'},{id:'rotation',material:'texture',yaw:20*Math.PI/180,pitch:10*Math.PI/180,label:'Photos · 20° / 10°'}];
let s3qaRunning=false;
const s3qaAssert=(ok,message)=>{if(!ok)throw Error(message)};
const s3qaPixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
function s3qaCompare(a,b){let sum=0,max=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);sum+=delta;max=Math.max(max,delta)}return{mean:sum/a.length,max}}
function s3qaImageMetrics(data,size){let opaque=0,nonWhite=0,cornerDeviations=0;for(let i=0;i<data.length;i+=4){if(data[i+3]===255)opaque++;if(data[i]<250||data[i+1]<250||data[i+2]<250)nonWhite++}for(const [left,top] of [[0,0],[size-12,0],[0,size-12],[size-12,size-12]])for(let y=top;y<top+12;y++)for(let x=left;x<left+12;x++){const p=(y*size+x)*4;for(let c=0;c<4;c++)if(data[p+c]!==255){cornerDeviations++;break}}return{pixels:size*size,opaque,nonWhite,cornerDeviations}}
function s3qaInvalidate(){state.photoVersion++;state.fullMorphCache=null;state.surface3DCache=null;state.openingMixCache=null;state.headTopology={version:-1,amount:0,metrics:null};state.stabilizedCache={key:'',geometry:null,fit:null,warning:''};invalidateFaceLighting();if(state.webgl)state.webgl.indexVersion=''}
function s3qaDepthCheck(){
 const renderer=createSurface3DRenderer(),size=96;
 const geometry={positions:new Float32Array([-.8,-.8,-.3,.8,-.8,-.3,0,.8,-.3,-.8,-.8,.3,.8,-.8,.3,0,.8,.3]),normals:new Float32Array([0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1]),uvA:new Float32Array(12),uvB:new Float32Array(12),cavity:new Float32Array([1,1,1,0,0,0]),indices:new Uint16Array([0,1,2,3,4,5]),textureMix:.5};
 try{
  // Near dark cavity is submitted first, then the distant light surface.
  // Without DEPTH_TEST the distant light triangle would overwrite the centre.
  const a=makeCanvas(size);a.getContext('2d').drawImage(renderer.render({geometry,size,material:'clay'}),0,0);const first=s3qaPixels(a);
  geometry.indices=new Uint16Array([3,4,5,0,1,2]);const b=makeCanvas(size);b.getContext('2d').drawImage(renderer.render({geometry,size,material:'clay'}),0,0);const second=s3qaPixels(b),difference=s3qaCompare(first,second),centre=Array.from(first.slice((48*size+48)*4,(48*size+48)*4+4));
  s3qaAssert(difference.max===0,'L’occlusion dépend de l’ordre des triangles');s3qaAssert(centre.slice(0,3).every(v=>v<80)&&centre[3]===255,'La surface éloignée recouvre la cavité proche');return{status:'PASS',orderDifference:difference,nearCavityCentre:centre};
 }finally{renderer.dispose()}
}
async function s3qaExecute(){
 if(s3qaRunning)return;s3qaRunning=true;s3qaRun.disabled=true;
 const results={scope:s3qaManual?'explicit-local-import':'repository-public-demo',checks:[],failures:[]},size=s3qaSize,panel=makeCanvas(size);panel.width=190+size*5;panel.height=74+(size+35)*3;const ctx=panel.getContext('2d');ctx.fillStyle='#18202b';ctx.fillRect(0,0,panel.width,panel.height);ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText('Surface 3D estimée · A → B · argile / photos / rotation',12,28);ctx.font='16px sans-serif';for(let i=0;i<5;i++)ctx.fillText(Math.round(s3qaPositions[i]*100)+' %',190+i*size+12,61);
 let original=null;const frames=new Map();
 const record=(name,fn)=>{try{const metrics=fn();results.checks.push({name,status:'PASS',...metrics});return metrics}catch(error){results.failures.push(name+' : '+error.message);results.checks.push({name,status:'FAIL',error:error.message});return null}};
 try{
  if(!s3qaManual)await loadDemoPair();stopAnimation({render:false});state.animation.userFrozen=true;
  s3qaAssert(state.photos.length===2&&state.marks.length===2,'Deux portraits importés sont nécessaires');
  original={photos:state.photos,originalPhotos:state.originalPhotos,portraitMattes:state.portraitMattes,marks:state.marks,headRings:state.headRings,pair:state.pair,auto:{...state.auto},morphTriangles:state.morphTriangles};
  const model=surface3DModel();s3qaAssert(model,'Surface 3D indisponible : '+state.surface3DCache?.warning);results.metadata=model.metadata;
  record('real-webgl-depth-order',s3qaDepthCheck);
  for(let row=0;row<s3qaVariants.length;row++){
   const variant=s3qaVariants[row],y=74+row*(size+35);ctx.fillStyle='#fff';ctx.fillText(variant.label,8,y+22,180);
   for(let col=0;col<5;col++){
    const amount=s3qaPositions[col],out=makeCanvas(size),geometry=surface3DGeometry({a:amount},variant);s3qaStatus.textContent='Validation '+variant.label+' · '+Math.round(amount*100)+' %';
    record(variant.id+'-'+amount,()=>{
     s3qaAssert(geometry,'Échantillon 3D absent');for(const name of ['positions','normals','uvA','uvB','mixUV'])s3qaAssert(geometry[name] instanceof Float32Array&&geometry[name].every(Number.isFinite),name+' non fini');
     for(let i=0;i<geometry.normals.length;i+=3)s3qaAssert(Math.abs(Math.hypot(...geometry.normals.subarray(i,i+3))-1)<1e-4,'Normale non unitaire');
     const info=renderSurface3DMorph(out,{...readControls(),a:amount},null,variant);s3qaAssert(!info.fallback,info.message);const pixels=s3qaPixels(out),image=s3qaImageMetrics(pixels,size);s3qaAssert(image.opaque===image.pixels,'Pixels transparents');s3qaAssert(image.nonWhite>size*size*.01,'Surface vide');s3qaAssert(image.cornerDeviations===0,'Coins du fond blanc altérés');
     let endpointError=0;if(amount===0||amount===1){const source=state.marks[amount===0?0:1];for(let i=0;i<geometry.points.length;i++)endpointError=Math.max(endpointError,Math.abs(geometry.points[i].x-source[i].x),Math.abs(geometry.points[i].y-source[i].y));s3qaAssert(endpointError<1e-10,'Coordonnées observées modifiées à une extrémité')}
     frames.set(variant.id+'-'+amount,pixels.slice());ctx.drawImage(out,190+col*size,y);return{amount,material:variant.material,vertices:geometry.positions.length/3,triangles:geometry.indices.length/3,depthRange:[Math.min(...geometry.positions.filter((_,i)=>i%3===2)),Math.max(...geometry.positions.filter((_,i)=>i%3===2))],image,endpointXYError:endpointError};
    });
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
  }
  record('rotation-changes-projection',()=>{const delta=s3qaCompare(frames.get('texture-0.5'),frames.get('rotation-0.5'));s3qaAssert(delta.mean>1,'La rotation ne modifie pas le rendu');return delta});
  record('clay-is-distinct-from-photos',()=>{const delta=s3qaCompare(frames.get('texture-0.5'),frames.get('clay-0.5'));s3qaAssert(delta.mean>1,'L’argile reproduit les photos');return delta});
  state.photos=original.photos.slice().reverse();state.originalPhotos=original.originalPhotos.slice().reverse();state.portraitMattes=original.portraitMattes.slice().reverse();state.marks=original.marks.slice().reverse();state.headRings=original.headRings.slice().reverse();s3qaInvalidate();autoAlign({activate:false,render:false});
  for(const amount of [.25,.5,.75])for(const material of ['clay','texture'])record('reverse-'+material+'-'+amount,()=>{const out=makeCanvas(size),info=renderSurface3DMorph(out,{...readControls(),a:1-amount},null,{material,yaw:0,pitch:0});s3qaAssert(!info.fallback,info.message);const delta=s3qaCompare(frames.get(material+'-'+amount),s3qaPixels(out));s3qaAssert(delta.mean<.03&&delta.max<=3,'Parcours inverse divergent : '+JSON.stringify(delta));return delta});
 }catch(error){results.failures.push(error.message)}
 finally{
  if(original){Object.assign(state,original);s3qaInvalidate();stopAnimation({render:false});state.animation.userFrozen=true;renderSelected(alignCanvas,{mode:'surface3d',values:{...readControls(),a:.5}})}
  results.status=results.failures.length?'FAIL':'PASS';s3qaMetrics.textContent=JSON.stringify(results,null,2);s3qaStatus.textContent=results.status+' · '+results.checks.filter(c=>c.status==='PASS').length+'/'+results.checks.length+' contrôles réussis'+(results.failures.length?'\n'+results.failures.join('\n'):'\nLes images doivent aussi être examinées visuellement.');
  let link=document.getElementById('surface3dQaDownload'),image=document.getElementById('surface3dQaPanel');if(!link){link=document.createElement('a');link.id='surface3dQaDownload';link.textContent='Télécharger le panneau PNG';link.style='display:block;color:#9fe7ff;padding:10px';link.download=s3qaManual?'surface3d-local-private.png':'surface3d-public.png';image=new Image();image.id='surface3dQaPanel';image.alt='Surface estimée aux cinq positions : argile, photos projetées, rotation';image.style='display:block;width:100%;height:auto';s3qaBox.append(link,image)}link.href=panel.toDataURL('image/png');image.src=link.href;s3qaRun.disabled=false;s3qaRunning=false;
 }
}
s3qaRun.addEventListener('click',s3qaExecute);
if(!s3qaManual)await s3qaExecute();
