const qaStatus=document.createElement('pre');qaStatus.id='qaResult';qaStatus.style='white-space:pre-wrap;color:#9fe7ff;padding:12px';qaStatus.textContent='Vérification en cours sur les deux portraits publics du dépôt…';document.body.prepend(qaStatus);
try{
 await loadDemoPair();stopAnimation({render:false});state.animation.userFrozen=true;
 const compare=(a,b)=>{let sum=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d)}return{mean:sum/a.length,max}};
 const pixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
 const results={renderer:[],endpoints:[],parity:[],continuity:[],reversal:[],regularization:fullMorphGeometry({a:.5})?.regularization};
 const size=384,frames=new Map(),publicPanel=makeCanvas(size);publicPanel.width=size*5;
 const panel=publicPanel.getContext('2d');
 for(const amount of [0,.001,.25,.5,.75,.999,1]){
  const out=makeCanvas(size),v={...readControls(),a:amount},started=performance.now();
  const info=renderFullMorph(out,v);if(info.fallback)throw Error(info.message);
  results.renderer.push({amount,engine:info.renderer,ms:performance.now()-started});
  const data=pixels(out);frames.set(amount,data);
  if([0,.25,.5,.75,1].includes(amount))panel.drawImage(out,[0,.25,.5,.75,1].indexOf(amount)*size,0);
  if(amount===0||amount===1){
   const expected=makeCanvas(size);expected.getContext('2d').drawImage(state.photos[amount===0?0:1],0,0,size,size);
   const diff=compare(data,pixels(expected));results.endpoints.push({amount,...diff});
   if(diff.max!==0)throw Error('Extrémité non exacte à '+amount);
  }else{
   const fallback=makeCanvas(size),geometry=fullMorphGeometry(v);
   renderCanvasMorph(fallback,v,geometry,state.photos);
   results.parity.push({amount,...compare(data,pixels(fallback))});
  }
 }
 results.continuity.push({near:0,...compare(frames.get(0),frames.get(.001))},{near:1,...compare(frames.get(.999),frames.get(1))});
 const originalPhotos=state.photos,originalMarks=state.marks,originalRings=state.headRings;
 state.photos=originalPhotos.slice().reverse();state.marks=originalMarks.slice().reverse();state.headRings=originalRings.slice().reverse();state.photoVersion++;
 for(const amount of [.25,.5,.75]){
  const out=makeCanvas(size);renderFullMorph(out,{...readControls(),a:1-amount});
  results.reversal.push({amount,...compare(frames.get(amount),pixels(out))});
 }
 for(const result of results.parity)if(result.mean>1||result.max>32)throw Error('Écart WebGL/Canvas excessif à '+result.amount);
 for(const result of results.continuity)if(result.mean>1||result.max>32)throw Error('Saut proche de '+result.near);
 for(const result of results.reversal)if(result.mean>.01||result.max>2)throw Error('Parcours inverse incohérent à '+result.amount);
 state.photos=originalPhotos;state.marks=originalMarks;state.headRings=originalRings;state.photoVersion++;
 renderSelected(alignCanvas,{mode:'full',values:{...readControls(),a:.5}});
 const download=document.createElement('a');download.id='qaDownload';download.textContent='Télécharger la comparaison publique 0 / 25 / 50 / 75 / 100 %';download.href=publicPanel.toDataURL('image/png');download.download='morphing-complet-demo-publique.png';document.body.prepend(download);
 const image=new Image();image.src=download.href;image.style='width:100%;height:auto';document.body.prepend(image);
 qaStatus.textContent='PASS — extrémités, continuité, comparaison des moteurs et parcours inverse sur portraits publics\n'+JSON.stringify(results,null,2);
}catch(error){qaStatus.textContent='FAIL — '+error.stack;console.error(error)}
