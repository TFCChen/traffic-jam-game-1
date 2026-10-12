// Read-only project audit; writes reports only inside this directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), out='docs/cleanup-audit-2026-10-11';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const tracked=new Set(git('ls-files','-z').split('\0'));
const untracked=new Set(git('ls-files','--others','--exclude-standard','-z').split('\0'));
const files=[], skipped=[], errors=[];
function walk(dir='') {
  for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const p=(dir?dir+'/':'')+e.name;
    if(p===out||e.isSymbolicLink()){skipped.push(p);continue;}
    if(e.isDirectory())walk(p);
    else {try{const s=fs.statSync(path.join(root,p));files.push({path:p,bytes:s.size,git:tracked.has(p)?'tracked':untracked.has(p)?'untracked':'ignored/internal'});}catch(e){errors.push({path:p,error:e.code});}}
  }
}
walk();
const sum=arr=>({files:arr.length,bytes:arr.reduce((a,f)=>a+f.bytes,0)});
const group=(arr,key)=>Object.entries(Object.groupBy(arr,key)).map(([name,items])=>({name,...sum(items)})).sort((a,b)=>b.bytes-a.bytes);
const generated=new Set(['.git','node_modules','.npm-cache','.browser-checks','dist']);
const project=files.filter(f=>!generated.has(f.path.split('/')[0]));
const textFiles=project.filter(f=>/\.(m?js|jsx|css|json|md|py|ya?ml|html|webmanifest|txt)$/.test(f.path)&&!f.path.startsWith('.codex-remote-attachments/')&&!f.path.startsWith('.tmp/'));
const texts=new Map(textFiles.map(f=>[f.path,fs.readFileSync(path.join(root,f.path),'utf8')]));
const references=(needle,excluding)=>[...texts].filter(([p,t])=>p!==excluding&&t.includes(needle)).map(([p])=>p);
const src=files.filter(f=>f.path.startsWith('src/'));
const edges=[];
for(const f of src.filter(f=>/\.(m?js|jsx|css)$/.test(f.path))){
 const t=texts.get(f.path)||'';
 for(const m of t.matchAll(/(?:from\s*|import\s*\(?\s*|new URL\(\s*)['"](\.[^'"]+)['"]/g)){
 const target=path.posix.normalize(path.posix.join(path.posix.dirname(f.path),m[1]));
 edges.push({from:f.path,to:target});
 }
}
const reach=new Set(['src/main.jsx']);let more=true;
while(more){more=false;for(const e of edges)if(reach.has(e.from)&&!reach.has(e.to)){reach.add(e.to);more=true;}}
const docs=files.filter(f=>f.path.startsWith('docs/'));
const media=files.filter(f=>/\.(png|jpe?g|webp|gif|mp4|webm|blend|glb)$/.test(f.path)&&!generated.has(f.path.split('/')[0]));
const hashes=new Map();
for(const f of media){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex');if(!hashes.has(hash))hashes.set(hash,[]);hashes.get(hash).push(f);}
const duplicates=[...hashes.values()].filter(a=>a.length>1).map(a=>({bytesEach:a[0].bytes,files:a.map(f=>f.path)}));
const data={date:new Date().toISOString(),head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),total:sum(files),top:group(files,f=>f.path.includes('/')?f.path.split('/')[0]:'(root files)'),docs:group(docs,f=>f.path.split('/').slice(0,2).join('/')),browser:group(files.filter(f=>f.path.startsWith('.browser-checks/')),f=>f.path.split('/').slice(0,2).join('/')),tmp:files.filter(f=>f.path.startsWith('.tmp/')),largest:project.toSorted((a,b)=>b.bytes-a.bytes).slice(0,20),srcUnreachable:src.filter(f=>!reach.has(f.path)&&!f.path.endsWith('.test.mjs')).map(f=>({path:f.path,references:references(path.posix.basename(f.path),f.path)})),scripts:files.filter(f=>f.path.startsWith('scripts/')&&!f.path.includes('__pycache__')).map(f=>({...f,references:references(path.posix.basename(f.path),f.path)})),duplicates,skipped,errors};
data.projectFiles=project;
data.browserEntries=fs.readdirSync(path.join(root,'.browser-checks'),{withFileTypes:true}).map(e=>{
 const p='.browser-checks/'+e.name;
 const items=files.filter(f=>f.path===p||f.path.startsWith(p+'/'));
 const profile=e.isDirectory()&&(fs.existsSync(path.join(root,p,'Local State'))||fs.existsSync(path.join(root,p,'Default')));
 return {path:p,directory:e.isDirectory(),profile,...sum(items)};
});
const links=[];
for(const [p,t] of texts)if(p.endsWith('.md'))for(const m of t.matchAll(/\]\(<?([^\s)>]+)>?\)/g)){
 let link=m[1].split('#')[0];
 if(!link||/^[a-z]+:/i.test(link)||link.startsWith('/'))continue;
 try{link=decodeURIComponent(link);}catch{}
 const target=path.posix.normalize(path.posix.join(path.posix.dirname(p),link));
 links.push({from:p,to:target,exists:fs.existsSync(path.join(root,target))});
}
data.links=links;
fs.writeFileSync(path.join(root,out,'inventory.json'),JSON.stringify(data,null,2));
const csv=(rows,columns)=>'\ufeff'+[columns,...rows.map(r=>columns.map(c=>JSON.stringify(r[c]??'')))].map(r=>r.join(',')).join('\r\n');
fs.writeFileSync(path.join(root,out,'project-files.csv'),csv(project,['path','bytes','git']));
fs.writeFileSync(path.join(root,out,'directory-sizes.csv'),csv(data.top,['name','files','bytes']));
fs.writeFileSync(path.join(root,out,'docs-directories.csv'),csv(data.docs,['name','files','bytes']));
console.log(JSON.stringify({total:data.total,top:data.top,srcUnreachable:data.srcUnreachable,duplicates:duplicates.length,errors,skipped:skipped.length},null,2));
