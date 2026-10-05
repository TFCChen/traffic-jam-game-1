import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const models = new URL('./public/models/', import.meta.url);
const hash = createHash('sha256');
for (const file of readdirSync(models).filter(f => f.endsWith('.glb')).sort()) {
  hash.update(file); hash.update(readFileSync(new URL(file, models)));
}
export const modelRevision = hash.digest('hex').slice(0, 16);
export default defineConfig({
  define: { __MODEL_REVISION__: JSON.stringify(modelRevision) },
});
