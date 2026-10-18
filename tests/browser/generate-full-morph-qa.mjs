// Generate a browser test from the current application source. Public demo only.
// Manual graphical checks are deliberately separate from the Node CI suite.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
let page=readFileSync(new URL('Taquin deux visages interpolés/v15-multiview.html',root),'utf8');
const script=readFileSync(new URL('./full-morph-qa.js',import.meta.url),'utf8');
page=page.replace('<head>','<head><base href="../Taquin%20deux%20visages%20interpol%C3%A9s/">');
const moduleEnd=page.lastIndexOf('</script>');
if(moduleEnd<0||!page.includes('function renderFullMorph('))throw Error('Application module not found; QA injection aborted.');
page=page.slice(0,moduleEnd)+'\n'+script+'\n'+page.slice(moduleEnd);
mkdirSync(new URL('work/',root),{recursive:true});
writeFileSync(new URL('work/full-morph-qa.html',root),page);
console.log('Generated work/full-morph-qa.html (ignored by Git). Serve the repository on localhost, then open that page. Optional ?qa768=1 adds a short 768px timing check. Public portraits only; no private data is read.');
