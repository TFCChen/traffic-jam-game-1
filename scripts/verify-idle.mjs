import {readFileSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const {evaluate,until,close}=await connect(process.argv[2]);
try {
  await until("document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready");
  const result=await evaluate(readFileSync(new URL('./check-scene-performance.js',import.meta.url),'utf8'));
  writeFileSync(new URL('../docs/upgrade-2026-10-05/idle-evidence.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {close();}
