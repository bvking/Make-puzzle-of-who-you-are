// Generate a browser test from the current application source. Public demo only.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
let page=readFileSync(new URL('Taquin deux visages interpolés/v15-multiview.html',root),'utf8');
const script=readFileSync(new URL('./full-morph-qa.js',import.meta.url),'utf8');
page=page.replace('<head>','<head><base href="../Taquin%20deux%20visages%20interpol%C3%A9s/">');
page=page.replace('</script>',script+'\n</script>');
mkdirSync(new URL('work/',root),{recursive:true});
writeFileSync(new URL('work/full-morph-qa.html',root),page);
console.log('Generated work/full-morph-qa.html (ignored by Git). Serve the repository on localhost, then open that page.');
