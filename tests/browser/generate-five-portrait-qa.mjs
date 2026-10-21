// Real-browser evaluation of five explicitly attributed public internet faces.
// The generated page is ignored; source photographs stay in the public QA set.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
let page=readFileSync(new URL('Taquin deux visages interpolés/v15-multiview.html',root),'utf8');
const script=readFileSync(new URL('./five-portrait-qa.js',import.meta.url),'utf8');
for(const contract of ['function renderSurface3DMorph(','function cropImportedFace(','async function candidateFromCanvas('])if(!page.includes(contract))throw Error('Application contract missing: '+contract);
page=page.replace('<head>','<head><base href="../Taquin%20deux%20visages%20interpol%C3%A9s/">');
const end=page.lastIndexOf('</script>');
if(end<0)throw Error('Application module missing.');
page=page.slice(0,end)+'\n'+script+'\n'+page.slice(end);
mkdirSync(new URL('work/',root),{recursive:true});
writeFileSync(new URL('work/five-portrait-qa.html',root),page);
console.log('Generated ignored work/five-portrait-qa.html. Serve this repository on localhost. Only the five public files named in app/qa/internet-five/manifest.json are loaded. No camera, upload or private file is used.');
