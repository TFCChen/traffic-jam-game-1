// One-time documentation cleanup using the approved 2026-10-11 snapshot.
// No game/source changes and no file deletion.
import fs from 'node:fs';
import path from 'node:path';
const dir='docs/cleanup-audit-2026-10-11';
const audit=JSON.parse(fs.readFileSync(`${dir}/cleanup-summary.json`,'utf8'));
const inventory=JSON.parse(fs.readFileSync(`${dir}/inventory.json`,'utf8'));
const deleted=new Set(audit.plans.filter(p=>['A','B'].includes(p.tier)).map(p=>p.path));
const media=/\.(png|jpe?g|webp|gif|mp4|webm)$/i;
const affectedDirs=new Set([...deleted].filter(p=>p.startsWith('docs/')&&media.test(p)).map(p=>p.split('/')[1]));
const note='> 2026-10-12 清理註記：本報告屬歷史版本。原始逐格圖／錄影及部分舊截圖已按核准清單清理；仍存在的拼圖／代表圖保留。下文的原檔名稱與 JSON 路徑僅為當時量測記錄，不能當成目前可開啟的檔案或重播輸入。';
let replaced=0, noted=0;const changed=[];
for(const entry of inventory.projectFiles.filter(f=>f.path.startsWith('docs/')&&f.path.endsWith('.md'))){
 const file=entry.path;if(deleted.has(file)||!fs.existsSync(file))continue;
 const old=fs.readFileSync(file,'utf8');
 let content=old.replace(/(!?)\[([^\]]*)\]\(<?([^\s)>]+)>?\)/g,(whole,image,label,url)=>{
  let link=url.split('#')[0];if(!link||/^[a-z]+:/i.test(link)||link.startsWith('/'))return whole;
  try{link=decodeURIComponent(link);}catch{}
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),link));
  if(!deleted.has(target))return whole;
  replaced++;
  return image?`（歷史驗證圖已清理：${label||path.posix.basename(target)}）`:`${label}（原始驗證檔已清理）`;
 });
 if(affectedDirs.has(file.split('/')[1])&&!content.includes(note)){
  const pos=content.indexOf('\n');content=content.slice(0,pos+1)+'\n'+note+'\n'+content.slice(pos+1);noted++;
 }
 if(content!==old){fs.writeFileSync(file,content);changed.push(file);}
}
// HANDOFF was consolidated separately; include its four removed historical links.
// Permit a rerun after partial document work, but verify every affected source.
const originalLinks=JSON.parse(fs.readFileSync(`${dir}/affected-document-links.json`,'utf8'));
const sourceFiles=[...new Set(originalLinks.map(l=>l.from))];
let unresolved=0;
for(const file of sourceFiles){
 const content=fs.readFileSync(file,'utf8');
 for(const m of content.matchAll(/\]\(<?([^\s)>]+)>?\)/g)){
  let link=m[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link)||link.startsWith('/'))continue;
  try{link=decodeURIComponent(link);}catch{}
  if(deleted.has(path.posix.normalize(path.posix.join(path.posix.dirname(file),link))))unresolved++;
 }
}
if(unresolved)throw new Error(`${unresolved} affected links remain`);
const planFile=`${dir}/README.md`;
let plan=fs.readFileSync(planFile,'utf8');
plan=plan.replace('這是建議清單，尚未刪除、搬移、提交、推送或部署任何內容。','以下是執行前的核准計畫快照；A/B 已於2026-10-12按使用者授權執行。最新結果見 [執行紀錄](execution-report.md)。');
plan=plan.replace('目前所有原檔仍在；本報告是可審閱的清理方案。','A/B 原檔已按核准清單刪除；REVIEW／KEEP保留。以下附表仍保留盤點時的大小／存在狀態，實際結果以 [執行紀錄](execution-report.md) 為準。');
plan+='\n## 執行附表（2026-10-12）\n\n[execute-cleanup.ps1](execute-cleanup.ps1) 僅執行本次已核准A/B快照；刪前檢查絕對路徑、連結、程序及每項檔案數／大小，任一不符即停止。它不是未來的通用清理命令，也不能在已刪除後直接重跑。\n\n[execution-preflight.json](execution-preflight.json) · [execution-result.json](execution-result.json) · [protected-file-hashes.json](protected-file-hashes.json) · [finalize-documents.mjs](finalize-documents.mjs) · [document-cleanup-result.json](document-cleanup-result.json)\n';
fs.writeFileSync(planFile,plan);
const annotatedReports=inventory.projectFiles.filter(f=>f.path.startsWith('docs/')&&f.path.endsWith('.md')&&fs.existsSync(f.path)&&fs.readFileSync(f.path,'utf8').includes(note)).map(f=>f.path);
const result={resolvedLinks:originalLinks.length,rewrittenHandoffLinks:originalLinks.filter(l=>l.from==='HANDOFF.md').length,replacedThisRun:replaced,annotatedReports,affectedSourceFiles:sourceFiles};
fs.writeFileSync(`${dir}/document-cleanup-result.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({resolvedLinks:originalLinks.length,annotatedReports:annotatedReports.length}));
