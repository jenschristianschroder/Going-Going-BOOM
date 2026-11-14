import {cp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const name of ['index.html','styles.css','manifest.webmanifest','sw.js','src','assets','vendor'])await cp(name,`dist/${name}`,{recursive:true});
// Version every module import as well as the entry points. GitHub Pages and
// an old service worker must never mix a new UI with cached old game rules.
const modules=(await readdir('src')).filter(name=>name.endsWith('.js')).sort();
const hash=createHash('sha256');
for(const name of ['index.html','styles.css','sw.js',...modules.map(n=>`src/${n}`)])hash.update(await readFile(name));
const release=hash.digest('hex').slice(0,12);
for(const name of modules){const source=await readFile(`src/${name}`,'utf8');await writeFile(`dist/src/${name}`,source.replace(/(from\s*['"])(\.\.?\/[^'"]+\.js)(['"])/g,`$1$2?v=${release}$3`));}
let html=await readFile('dist/index.html','utf8');
html=html.replace('./styles.css',`./styles.css?v=${release}`).replace('./src/app.js',`./src/app.js?v=${release}`).replace('<meta charset="UTF-8">',`<meta charset="UTF-8">\n  <meta name="build" content="${release}">`);
await writeFile('dist/index.html',html);
let sw=await readFile('dist/sw.js','utf8');
sw=sw.replace(/const CACHE='[^']+'/,`const CACHE='ggboom-${release}'`).replace(/(['"])(\.\/[^'"]+\.(?:js|css))\1/g,`$1$2?v=${release}$1`);
await writeFile('dist/sw.js',sw);
console.log(`Built static site in dist/ (release ${release}; no production dependencies).`);
