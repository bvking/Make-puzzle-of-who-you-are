// Manual checks using ONLY the public demo pair shipped in this repository.
// Injected into the application's module scope by the accompanying generator.
const qaStatus=document.createElement('pre');qaStatus.id='qaResult';qaStatus.style='white-space:pre-wrap;color:#9fe7ff;padding:12px';qaStatus.textContent='Vérification sur les deux portraits publics du dépôt…';document.body.prepend(qaStatus);
const qaNote=document.createElement('p');qaNote.id='qaScope';qaNote.style='color:#ddd;padding:12px';qaNote.textContent='Comparaison publique : trajet 2D linéaire sans sélection de texture / nouveau moteur. Les variantes modifient uniquement le cadrage 2D de B. Elles ne simulent ni une nouvelle expression, ni une vraie perspective 3D. Les écarts numériques ne mesurent pas le naturel du morphing.';qaStatus.after(qaNote);
const qaDetails=document.createElement('details'),qaSummary=document.createElement('summary'),qaMetrics=document.createElement('pre');qaSummary.textContent='Détails des mesures techniques';qaMetrics.id='qaMetrics';qaMetrics.style='white-space:pre-wrap';qaDetails.append(qaSummary,qaMetrics);qaNote.after(qaDetails);
let qaOriginal=null;
const qaResults={scope:'Public demo only; 2D scale/rotation/affine robustness, not new expressions or 3D perspective',cases:[],failures:[]};
const qaPositions=[0,.25,.5,.75,1],qaSize=384,qaRowHeight=414,qaLabelWidth=180;
const qaCases=[
 {id:'native',label:'Portraits publics natifs',transform:null},
 {id:'scale-rotation',label:'B : taille 78 %, rotation 8°',transform:{scale:.78,angle:8,dx:14,dy:-12}},
 {id:'affine',label:'B : affine légère, rotation −5°',transform:{scale:.9,angle:-5,sx:1.05,sy:.95,shear:.035,dx:-8,dy:10}}
];
const qaPanel=makeCanvas(qaSize);qaPanel.width=qaLabelWidth+qaSize*qaPositions.length;qaPanel.height=90+qaRowHeight*qaCases.length*2;
const qaPanelContext=qaPanel.getContext('2d');qaPanelContext.fillStyle='#111820';qaPanelContext.fillRect(0,0,qaPanel.width,qaPanel.height);qaPanelContext.fillStyle='#fff';qaPanelContext.font='24px sans-serif';qaPanelContext.fillText('Deux personnes différentes · portraits publics · comparaison contrôlée',18,32);qaPanelContext.font='18px sans-serif';qaPanelContext.fillText('Les transformations de cadrage 2D ne valident pas les expressions extrêmes ni la perspective 3D.',18,62);
for(let i=0;i<qaPositions.length;i++)qaPanelContext.fillText(Math.round(qaPositions[i]*100)+' %',qaLabelWidth+i*qaSize+12,85);
const qaPixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
function qaCompare(a,b){let sum=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d)}return{mean:sum/a.length,max}}
function qaWhiteCorners(pixels,size,patchSize=12){
 const corners=[['top-left',0,0],['top-right',size-patchSize,0],['bottom-left',0,size-patchSize],['bottom-right',size-patchSize,size-patchSize]].map(([name,left,top])=>{
  let maxDeviation=0,nonWhitePixels=0;
  for(let y=top;y<top+patchSize;y++)for(let x=left;x<left+patchSize;x++){
   const offset=(y*size+x)*4;let deviation=0;
   for(let channel=0;channel<4;channel++)deviation=Math.max(deviation,Math.abs(255-pixels[offset+channel]));
   maxDeviation=Math.max(maxDeviation,deviation);if(deviation)nonWhitePixels++;
  }
  return{name,checkedPixels:patchSize*patchSize,maxDeviation,nonWhitePixels};
 });
 return{patchSize,corners,maxDeviation:Math.max(...corners.map(corner=>corner.maxDeviation)),nonWhitePixels:corners.reduce((sum,corner)=>sum+corner.nonWhitePixels,0)};
}
function qaAssert(condition,message){if(!condition)throw Error(message)}
function qaProgress(message){
 const maximum=(checks,key)=>checks.length?Math.max(...checks.map(check=>check[key])).toFixed(3):'—';
 const lines=qaResults.cases.map(c=>c.id+' : '+(c.status||'en cours')+' · extrémités max '+maximum(c.endpoints,'max')+' · écart fond blanc max '+maximum(c.whiteCorners,'maxDeviation')+' · parité moy/max '+maximum(c.parity,'mean')+'/'+maximum(c.parity,'max')+' · inverse max '+maximum(c.reversal,'max')+' · pixels modifiés hors cavités '+(c.visibility.length?Math.max(...c.visibility.map(v=>v.outsideChanged??0)):'—')+(c.benchmark?' · nouveau p50/p95 '+c.benchmark.new384.p50.toFixed(1)+'/'+c.benchmark.new384.p95.toFixed(1)+' ms':'')+(c.error?' · '+c.error:''));
 qaStatus.textContent=message+'\n'+lines.join('\n');qaMetrics.textContent=JSON.stringify(qaResults,null,2);
}
function qaInvalidate(){state.photoVersion++;state.fullMorphCache=null;state.headTopology={version:-1,amount:0,metrics:null};state.stabilizedCache={key:'',geometry:null,fit:null,warning:''};invalidateFaceLighting();if(state.webgl)state.webgl.indexVersion=''}
function qaRestore(){if(!qaOriginal)return;state.photos=qaOriginal.photos;state.marks=qaOriginal.marks;state.headRings=qaOriginal.headRings;state.pair=qaOriginal.pair;state.auto={...qaOriginal.auto};state.morphTriangles=qaOriginal.morphTriangles;state.morphTrianglesVersion=-1;state.morphTopologyVersion++;qaInvalidate()}
function qaAffine(spec){
 const r=spec.angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r),sx=spec.scale*(spec.sx??1),sy=spec.scale*(spec.sy??1),h=spec.shear??0;
 const a=c*sx,b=s*sx,cc=c*h-s*sy,d=s*h+c*sy,cx=SIZE/2,cy=SIZE/2;
 return{a,b,c:cc,d,e:cx+(spec.dx??0)-a*cx-cc*cy,f:cy+(spec.dy??0)-b*cx-d*cy};
}
function qaApplyCase(spec){
 qaRestore();
 if(spec.transform){
  const m=qaAffine(spec.transform),photo=makeCanvas(SIZE),ctx=photo.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,SIZE,SIZE);ctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(qaOriginal.photos[1],0,0);ctx.setTransform(1,0,0,1,0,0);
  state.photos=[qaOriginal.photos[0],photo];state.marks=[qaOriginal.marks[0],qaOriginal.marks[1].map(p=>{const q=mapPoint(m,{x:p.x*SIZE,y:p.y*SIZE});return{...p,x:q.x/SIZE,y:q.y/SIZE}})];state.headRings=[qaOriginal.headRings[0],qaOriginal.headRings[1].map(p=>mapPoint(m,p))];
  qaInvalidate();autoAlign({activate:false,render:false});
 }
 stopAnimation({render:false});state.animation.userFrozen=true;
 qaAssert(canMeshMorph(),'Paire refusée pour '+spec.id+' : '+state.pair.status);
 qaAssert(fullMorphGeometry({a:.5}),'Géométrie complète refusée pour '+spec.id);
}
// Explicit linear-2D reference. Same images and skin topology; historical
// aperture strips, no iris anchors, no local visibility selection.
function qaBaselineModel(){return createFullFaceMorph(landmarkPoints(0),landmarkPoints(1),state.meshTriangles,state.faceOval,{strength:0,poseNormalization:false,irisAlignment:false})}
function qaBaselineGeometry(model,t){
 const face=model?.sample(t);if(!face)return null;
 face.target=face.raw1.map((p,i)=>lerpPoint(p,face.raw2[i],t));face.t=t;face.head1=state.headRings[0]||fallbackHeadRing(face.raw1);face.head2=state.headRings[1]||fallbackHeadRing(face.raw2);
 const portrait=fullFrameGeometry(face);if(!portrait)return null;
 return{...portrait,triangles:portrait.contextTriangles.concat(face.triangles),textureMix:t,openingVisibility:null,fullMorph:true,sourceKey:'qa-linear-raw|'+state.photoVersion};
}
function qaRenderBaseline(out,t,model){
 if(t===0||t===1)return renderPortraitEndpoint(out,t===0?0:1,state.photos[t===0?0:1]);
 const geometry=qaBaselineGeometry(model,t);qaAssert(geometry,'Géométrie de référence manquante');
 const image=renderWebGLFace(out.width,geometry,state.photos);
 if(image){const ctx=out.getContext('2d');ctx.clearRect(0,0,out.width,out.height);ctx.drawImage(image,0,0);return{fallback:false,renderer:'webgl'}}
 return renderCanvasMorph(out,{...readControls(),a:t},geometry,state.photos);
}
function qaInsidePolygon(point,contour){let inside=false;for(let i=0,j=contour.length-1;i<contour.length;j=i++){const a=contour[i],b=contour[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
function qaSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function qaNearOpening(point,regions,margin){return regions.some(region=>qaInsidePolygon(point,region.contour)||region.contour.some((a,i)=>qaSegmentDistance(point,a,region.contour[(i+1)%region.contour.length])<=margin))}
function qaVisibility(geometry,size){
 const sample=geometry.openingVisibility;
 if(!sample||typeof openingMixMap!=='function')return{available:false};
 const map=openingMixMap(geometry,size);qaAssert(map?.weights?.length===size*size,'Carte des ouvertures absente ou de taille incorrecte');
 const regions=sample.regions||[],tolerance=2/65535;let changed=0,outsideChanged=0,maxOutsideDeviation=0,maxChange=0;
 for(const region of regions){
  qaAssert(Array.isArray(region.contour)&&region.contour.length>=3,'Contour de cavité incorrect');
  for(const value of [region.textureMix,region.apertureA,region.apertureB,region.targetAperture])qaAssert(Number.isFinite(value),'Poids/ouverture non fini');
  qaAssert(region.textureMix>=0&&region.textureMix<=1,'Poids de cavité hors [0,1]');
  qaAssert((region.apertureB-region.apertureA)*(region.textureMix-geometry.t)>=-1e-7,'Préférence opposée à la source ouverte');
 }
 for(let index=0;index<map.weights.length;index++){
  const weight=map.weights[index];qaAssert(Number.isFinite(weight)&&weight>=0&&weight<=1,'Poids spatial hors [0,1]');
  const difference=Math.abs(weight-geometry.t);maxChange=Math.max(maxChange,difference);if(difference<=tolerance)continue;changed++;
  // Two output pixels allow raster contour coverage, without accepting a broad
  // correction of lips, cheeks, skin or glasses around the opening.
  const point={x:(index%size+.5)*SIZE/size,y:(Math.floor(index/size)+.5)*SIZE/size};
  if(!qaNearOpening(point,regions,2*SIZE/size)){outsideChanged++;maxOutsideDeviation=Math.max(maxOutsideDeviation,difference)}
 }
 qaAssert(outsideChanged===0,'Le poids de texture déborde des cavités : '+outsideChanged+' pixels');
 return{available:true,regions:regions.map(({id,textureMix,apertureA,apertureB})=>({id,textureMix,apertureA,apertureB})),changedPixels:changed,outsideChanged,maxOutsideDeviation,maxChange};
}
async function qaBenchmark(render,size,iterations=12){
 const out=makeCanvas(size),amounts=[.23,.41,.57,.73],times=[];
 for(let i=0;i<4;i++)render(out,amounts[i%amounts.length]);
 for(let i=0;i<iterations;i++){const start=performance.now();render(out,amounts[i%amounts.length]);times.push(performance.now()-start)}
 times.sort((a,b)=>a-b);await new Promise(resolve=>requestAnimationFrame(resolve));
 return{size,warmup:4,samples:iterations,p50:times[Math.floor((times.length-1)*.5)],p95:times[Math.ceil((times.length-1)*.95)]};
}
function qaPublishPanel(){
 let download=document.getElementById('qaDownload');if(!download){download=document.createElement('a');download.id='qaDownload';download.style='display:block;padding:12px;color:#9fe7ff';download.textContent='Télécharger le panneau PNG public : référence / nouveau moteur';download.download='morphing-public-reference-nouveau-moteur.png';qaNote.after(download)}download.href=qaPanel.toDataURL('image/png');
 let image=document.getElementById('qaPanel');if(!image){image=new Image();image.id='qaPanel';image.alt='Comparaison publique aux cinq positions pour trois variantes de cadrage 2D';image.style='display:block;width:100%;height:auto';download.after(image)}image.src=download.href;
}
try{
 await loadDemoPair();stopAnimation({render:false});state.animation.userFrozen=true;
 // This runner loads only repository demo assets. Publish a small metadata
 // allowlist, never a full matte object or any pixel/landmark buffer.
 qaResults.portraitMatting=state.portraitMattes.map((matte,index)=>({source:index?'public-demo-B':'public-demo-A',method:matte.method,warning:matte.warning}));
 qaOriginal={photos:state.photos,marks:state.marks,headRings:state.headRings,pair:state.pair,auto:{...state.auto},morphTriangles:state.morphTriangles};
 for(let caseIndex=0;caseIndex<qaCases.length;caseIndex++){
  const spec=qaCases[caseIndex],result={id:spec.id,label:spec.label,transform:spec.transform||null,renderer:[],endpoints:[],whiteCorners:[],parity:[],continuity:[],reversal:[],visibility:[],baselineDifference:[]};qaResults.cases.push(result);qaProgress('Comparaison publique '+(caseIndex+1)+' / '+qaCases.length+' : '+spec.label);
  try{
   qaApplyCase(spec);const baseline=qaBaselineModel(),frames=new Map();qaAssert(baseline,'Modèle de référence indisponible');
   const mid=fullMorphGeometry({a:.5});result.regularization=mid.regularization;result.poseNormalization=true;result.irisAnchors=mid.irisAnchors||[];
   for(let row=0;row<2;row++){const y=90+(caseIndex*2+row)*qaRowHeight;qaPanelContext.fillStyle='#fff';qaPanelContext.font='16px sans-serif';qaPanelContext.fillText(spec.label,8,y+24,qaLabelWidth-16);qaPanelContext.fillText(row?'Nouveau moteur':'Référence 2D',8,y+49,qaLabelWidth-16)}
   for(const amount of [0,.001,.25,.5,.75,.999,1]){
    const out=makeCanvas(qaSize),v={...readControls(),a:amount},info=renderFullMorph(out,v);qaAssert(!info.fallback,info.message);result.renderer.push({amount,engine:info.renderer});const data=qaPixels(out);frames.set(amount,data);
    if(qaPositions.includes(amount)){
     const white=qaWhiteCorners(data,qaSize);result.whiteCorners.push({amount,...white});qaAssert(white.nonWhitePixels===0,'Fond non blanc opaque dans les coins 12 px à '+amount+' : '+white.nonWhitePixels+' pixels');
     const column=qaPositions.indexOf(amount),rowTop=90+caseIndex*2*qaRowHeight,reference=makeCanvas(qaSize);qaRenderBaseline(reference,amount,baseline);qaPanelContext.drawImage(reference,qaLabelWidth+column*qaSize,rowTop);qaPanelContext.drawImage(out,qaLabelWidth+column*qaSize,rowTop+qaRowHeight);result.baselineDifference.push({amount,...qaCompare(data,qaPixels(reference))});
    }
    if(amount===0||amount===1){
     const expected=makeCanvas(qaSize);expected.getContext('2d').drawImage(state.photos[amount===0?0:1],0,0,qaSize,qaSize);const diff=qaCompare(data,qaPixels(expected));result.endpoints.push({amount,...diff});qaAssert(diff.max===0,'Extrémité non exacte à '+amount);
    }else{
     const fallback=makeCanvas(qaSize),geometry=fullMorphGeometry(v);renderCanvasMorph(fallback,v,geometry,state.photos);const diff=qaCompare(data,qaPixels(fallback));result.parity.push({amount,...diff});qaAssert(diff.mean<=1&&diff.max<=32,'Écart WebGL/Canvas excessif à '+amount);
     if([.25,.5,.75].includes(amount))result.visibility.push({amount,...qaVisibility(geometry,qaSize)});
    }
   }
   result.continuity.push({near:0,...qaCompare(frames.get(0),frames.get(.001))},{near:1,...qaCompare(frames.get(.999),frames.get(1))});
   for(const check of result.continuity)qaAssert(check.mean<=1&&check.max<=32,'Saut proche de '+check.near);
   const forward={photos:state.photos,marks:state.marks,headRings:state.headRings,pair:state.pair,auto:{...state.auto}};
   try{
    state.photos=forward.photos.slice().reverse();state.marks=forward.marks.slice().reverse();state.headRings=forward.headRings.slice().reverse();qaInvalidate();autoAlign({activate:false,render:false});
    const reverseWarp=state.pair.metrics?.warp;result.reversePair={status:state.pair.status,score:state.pair.score,reasons:state.pair.reasons,scale:state.pair.metrics?.scale,combinedRisk:state.pair.metrics?.combinedRisk,warp:reverseWarp};
    qaAssert(canMeshMorph(),'Paire inversée refusée : '+JSON.stringify(result.reversePair));
    for(const amount of [.25,.5,.75]){const out=makeCanvas(qaSize),info=renderFullMorph(out,{...readControls(),a:1-amount});qaAssert(!info.fallback,'Parcours inverse indisponible');const diff=qaCompare(frames.get(amount),qaPixels(out));result.reversal.push({amount,...diff});qaAssert(diff.mean<=.01&&diff.max<=2,'Parcours inverse incohérent à '+amount)}
   }finally{state.photos=forward.photos;state.marks=forward.marks;state.headRings=forward.headRings;state.pair=forward.pair;state.auto=forward.auto;qaInvalidate()}
   result.benchmark={new384:await qaBenchmark((out,t)=>renderFullMorph(out,{...readControls(),a:t}),qaSize),baseline384:await qaBenchmark((out,t)=>qaRenderBaseline(out,t,baseline),qaSize)};
   if(new URLSearchParams(location.search).get('qa768')==='1')result.benchmark.new768=await qaBenchmark((out,t)=>renderFullMorph(out,{...readControls(),a:t}),768,3);
   result.status='PASS';
  }catch(error){result.status='FAIL';result.error=error.message;qaResults.failures.push(spec.id+' : '+error.message);console.error('Public QA '+spec.id,error)}
  qaPublishPanel();await new Promise(resolve=>requestAnimationFrame(resolve));
 }
}catch(error){qaResults.failures.push(error.message);console.error(error)}
finally{
 qaRestore();if(qaOriginal)renderSelected(alignCanvas,{mode:'full',values:{...readControls(),a:.5}});qaPublishPanel();
 qaProgress((qaResults.failures.length?'FAIL':'PASS')+' — contrôles techniques sur portraits publics ; le panneau doit aussi être examiné visuellement.');
}
