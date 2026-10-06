import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const models = new URL('./public/models/', import.meta.url);
const hash = createHash('sha256');
for (const file of readdirSync(models).filter(f => f.endsWith('.glb')).sort()) {
  hash.update(file); hash.update(readFileSync(new URL(file, models)));
}
export const modelRevision = hash.digest('hex').slice(0, 16);
const versionHash = createHash('sha256').update(modelRevision);
const sourceRoot = new URL('./src/', import.meta.url);
function hashSources(dir) {
  for (const file of readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)) {
    const path = new URL(file.name + (file.isDirectory()?'/':''), dir);
    if (file.isDirectory()) hashSources(path);
    else versionHash.update(path.pathname.replace(sourceRoot.pathname,'')).update(readFileSync(path,'utf8').replace(/\r\n/g,'\n'));
  }
}
hashSources(sourceRoot);
versionHash.update(readFileSync(new URL('./scripts/build-offline.mjs', import.meta.url),'utf8').replace(/\r\n/g,'\n'));
export const appVersion = versionHash.digest('hex').slice(0, 8);
export default defineConfig({
  define: { __MODEL_REVISION__: JSON.stringify(modelRevision), __APP_VERSION__: JSON.stringify(appVersion) },
});
