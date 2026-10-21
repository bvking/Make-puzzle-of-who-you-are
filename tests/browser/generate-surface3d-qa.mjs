// Manual real-WebGL checks. Only repository public portraits load automatically.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
let page=readFileSync(new URL('Taquin deux visages interpolés/v15-multiview.html',root),'utf8');
const script=readFileSync(new URL('./surface3d-qa.js',import.meta.url),'utf8');
if(!page.includes('function renderSurface3DMorph('))throw Error('Surface 3D adapter missing; injection aborted.');
page=page.replace('<head>','<head><base href="../Taquin%20deux%20visages%20interpol%C3%A9s/">');
const end=page.lastIndexOf('</script>');
if(end<0)throw Error('Application module missing.');
page=page.slice(0,end)+'\n'+script+'\n'+page.slice(end);
mkdirSync(new URL('work/',root),{recursive:true});
writeFileSync(new URL('work/surface3d-qa.html',root),page);
console.log('Generated ignored work/surface3d-qa.html. Serve repository on localhost. Default: public demo only. ?qaManual=1 waits for an explicit local archive import and a Test button; no private file is fetched automatically.');
