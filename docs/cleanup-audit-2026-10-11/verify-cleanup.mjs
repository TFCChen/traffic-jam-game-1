// Read-only checks against the original approved cleanup snapshot.
// Writes only this audit's verification result; skips filesystem links.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir='docs/cleanup-audit-2026-10-11';
const baseline=JSON.parse(fs.readFileSync(`${dir}/protected-file-hashes.json`,'utf8'));
const changed=[];
for(const [file,hash] of Object.entries(baseline)){
 if(!fs.existsSync(file)){changed.push({file,reason:'missing'});continue;}
 const now=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(now!==hash)changed.push({file,reason:'hash mismatch'});
}
const audit=JSON.parse(fs.readFileSync(`${dir}/cleanup-summary.json`,'utf8'));
const remainingTargets=audit.plans.filter(p=>['A','B'].includes(p.tier)&&fs.existsSync(p.path)).map(p=>p.path);
const files=[],skippedLinks=[];
function walk(dirName=''){
 for(const e of fs.readdirSync(dirName||'.',{withFileTypes:true})){
  const p=dirName?dirName+'/'+e.name:e.name;
  if(e.isSymbolicLink()){skippedLinks.push(p);continue;}
  if(e.isDirectory())walk(p);else files.push({path:p,bytes:fs.statSync(p).size});
 }
}
walk();
const brokenLinks=[];
for(const {path:file} of files.filter(f=>f.path.endsWith('.md')&&!/^(?:node_modules|\.git|\.browser-checks|dist)\//.test(f.path))){
 const content=fs.readFileSync(file,'utf8');
 for(const match of content.matchAll(/\]\(<?([^\s)>]+)>?\)/g)){
  let link=match[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link)||link.startsWith('/'))continue;
  try{link=decodeURIComponent(link);}catch{}
  const to=path.posix.normalize(path.posix.join(path.posix.dirname(file),link));
  if(!fs.existsSync(to))brokenLinks.push({from:file,to});
 }
}
const total=items=>({files:items.length,bytes:items.reduce((sum,f)=>sum+f.bytes,0)});
const result={timestamp:new Date().toISOString(),protectedFilesChecked:Object.keys(baseline).length,changedProtectedFiles:changed,remainingTargets,brokenLinks,total:total(files),top:Object.entries(Object.groupBy(files,f=>f.path.split('/').length>1?f.path.split('/')[0]:'(root)')).map(([name,entries])=>({name,...total(entries)})).sort((a,b)=>b.bytes-a.bytes),skippedLinks};
fs.writeFileSync(`${dir}/verification-result.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(changed.length||remainingTargets.length||brokenLinks.length)process.exitCode=1;
