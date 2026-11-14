import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const name of ['index.html','styles.css','manifest.webmanifest','sw.js','src','assets','vendor'])await cp(name,`dist/${name}`,{recursive:true});
console.log('Built static site in dist/ (no production dependencies).');
