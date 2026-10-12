// Produces recommendations only. No delete, move, Git write, or deployment.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), dir='docs/cleanup-audit-2026-10-11';
const a=JSON.parse(fs.readFileSync(path.join(dir,'inventory.json'),'utf8'));
const files=a.projectFiles, plans=[];
const oldDocs=new Set([
 'traffic-night-2026-10-10','traffic-offscreen-2026-10-11','traffic-variety-2026-10-11',
 'street-gardens-2026-10-11','street-integration-2026-10-11','street-passages-2026-10-11',
 'tunnel-details-2026-10-11','tunnel-foundation-2026-10-11','tunnel-polish-2026-10-11','tunnel-refinement-2026-10-11','tunnel-symmetry-2026-10-11',
 'celebration-review','peek-celebration-review','plush-celebration-review','celebration-cohesion-review','stages-2026-10-07'
]);
const keepEvidenceDirs=new Set(['reference-celebration-review','celebration-screen-edge-review','goal-intro-review','win-settle-2026-10-11','brake-spill-2026-10-11','signal-light-review-2026-10-11','trial-return-review']);
const selectedMedia=new Set([
 'docs/stable-shadow-2026-10-07/day-after.png','docs/stable-shadow-2026-10-07/day-before.png',
 'docs/stable-shadow-2026-10-07/phase/fixed-0.png','docs/stable-shadow-2026-10-07/phase/rotating-0.png',
 'docs/editor-repair-2026-10-07/editor-model-menu.png',
]);
const linked=new Map();for(const l of a.links){if(!linked.has(l.to))linked.set(l.to,[]);linked.get(l.to).push(l.from);}
const add=(f,tier,reason,group,conditions='')=>plans.push({...f,tier,group,reason,conditions,links:(linked.get(f.path)||[]).join(' | ')});
for(const f of files){
 const p=f.path,base=path.posix.basename(p),d=p.split('/')[1];
 if(p.startsWith('docs/')){
  if(oldDocs.has(d))add(f,'B','功能已撤回或畫面方案已被取代；不參與遊戲載入／建置','已廢除方案','刪除整組前將否決原因留在精簡交班，修正其他文件連結；未追蹤檔無Git備份');
  else if(/\.(png|jpe?g|mp4|webm|gif|webp)$/.test(p)){
   const representative=keepEvidenceDirs.has(d)||selectedMedia.has(p)||/contact|sheet|grid/i.test(base);
   if(representative)add(f,'KEEP','目前視覺／重要修正的少量代表證據','精選驗證證據');
   else if(linked.has(p))add(f,'B','歷史驗證媒體，不是遊戲素材','舊文件所連圖片／影片','刪除時一併精簡報告，修正Markdown圖片連結');
   else add(f,'A','歷史驗證原始媒體，非遊戲／建置輸入，未被Markdown連結指向','未連結的原始驗證圖片／影片','檔名可能出現在報告純文字或腳本輸出；刪圖後調整報告對證據範圍的描述');
  }else add(f,'KEEP','體積小的根因／測試方法／量測資料；先保留以免再次踩坑','驗證文字與數據');
 }else if(p.startsWith('art/plush-mascots/'))add(f,'B','舊八隻動物已被參考動物取代；public舊素材早已移除','舊動物製作紀錄','將淘汰理由及歷史提交b6d94b1留在交班，更新指向這裡的說明');
 else if(p.includes('/__pycache__/')||p.startsWith('art/')&&p.endsWith('.log'))add(f,'A','可重新產生的Python快取／舊產模日誌','快取與舊日誌');
 else if(p==='scripts/verify-stages.mjs')add(f,'B','仍要求已取消的editor-vehicle-cards／editor-orientation／win-up-next；CI沒有呼叫','舊編輯器驗證腳本','移除相應舊報告的重跑說明；不刪verify-stage-models.mjs');
 else if(p.startsWith('.codex-remote-attachments/'))add(f,'REVIEW','使用者原始參考圖／問題錄影，尚未提交，並非可重建快取','使用者附件','先保留或另存到專案外；不可把唯一原件當驗證截圖刪掉');
 else if(p.endsWith('.log'))add(f,'REVIEW','服務可能仍在寫入；刪除不會改善Git清單','目前服務日誌','確認未開啟或停止相關服務後才能清；本輪不打斷4173');
 else if(p==='art/toy-garage.blend')add(f,'KEEP','全車型源檔集合；不能因名字舊就刪，可能含無獨立blend的商用車原始網格','Blender來源');
 else if(p.startsWith('art/')&&p.endsWith('.blend'))add(f,'KEEP','可編輯模型原始檔，GLB不能完整取代Blender來源','Blender來源');
 else if(p.startsWith('scripts/'))add(f,'KEEP','建置／CI／產模／可重跑回歸或量測工具；沒被npm直接呼叫不代表沒用','工具腳本');
 else add(f,'KEEP','目前程式、素材、關卡、設定或交班入口','遊戲與開發基礎');
}
for(const e of a.browserEntries){
 const n=path.posix.basename(e.path);
 if(e.profile)add({...e,git:'ignored'},'A','專用測試Chrome設定檔、下載元件與快取，可重建','測試瀏覽器設定檔','刪除前確認無程序使用；本次程序快照引用.browser-checks數量0；會失去該測試profile的合成存檔，非平常玩家的瀏覽器資料');
 else if(e.directory&&(/^(exit-recording-|camera-video$|flicker-video$|fence-after$|fence-before$|mobile-flicker$|shadow-phase$|glass$)/.test(n)))add({...e,git:'ignored'},'A','歷史錄影逐格圖／診斷截圖，不是遊戲資源','暫存擷取與診斷輸出');
 else if(e.directory)add({...e,git:'ignored'},'REVIEW','舊基準副本或額外工具；不與重建快取混刪','暫存基準／工具','baseline/node_modules是連結，刪除時不得跟隨；video-tools可重用');
 else if(/\.(py|mjs|cjs|html|glb|pdf|zip)$/.test(n))add({...e,git:'ignored'},'REVIEW','可能含唯一修模步驟、舊模型比較基準、下載參考或圖示產製工具','暫存內的來源／基準','先比對Git可恢復性，將需要的腳本移入正式工具區；不要整個.browser-checks一刀刪');
 else add({...e,git:'ignored'},'A','舊截圖／量測輸出／測試連線資訊或日誌','暫存擷取與診斷輸出');
}
const cache=a.top.find(d=>d.name==='.npm-cache');if(cache)add({path:'.npm-cache/',...cache,git:'ignored'},'A','npm套件下載快取，可重新下載；node_modules不受影響','npm下載快取','沒有npm安裝正在執行時清理');
for(const name of ['dist','node_modules','.git']){
 const e=a.top.find(d=>d.name===name);add({path:name+'/',...e,git:'ignored/internal'},name==='.git'?'KEEP':'REVIEW',name==='dist'?'4173正在服務此建置產物；可重建但現在不能清':name==='node_modules'?'本機依賴可npm ci重裝，但不是歷史廢案':'.git保存完整提交與回退歷史；禁止手動刪objects或壓縮包','環境與版本庫',name==='.git'?'刪除工作樹中的歷史圖片不會縮小已有Git歷史；本輪不改寫歷史':'需要額外重建／重新安裝，與歷史資料清理分開');
}
const columns=['tier','group','path','files','bytes','git','reason','conditions','links'];
const csv='\ufeff'+[columns,...plans.map(p=>columns.map(c=>JSON.stringify(p[c]??(c==='files'?1:''))))].map(r=>r.join(',')).join('\r\n');
fs.writeFileSync(path.join(dir,'cleanup-manifest.csv'),csv);
const summary=Object.entries(Object.groupBy(plans,p=>p.tier)).map(([tier,items])=>({tier,entries:items.length,files:items.reduce((s,p)=>s+(p.files??1),0),bytes:items.reduce((s,p)=>s+p.bytes,0)}));
const groups=Object.entries(Object.groupBy(plans,p=>p.group)).map(([name,items])=>({name,tier:[...new Set(items.map(p=>p.tier))].join('/'),files:items.reduce((s,p)=>s+(p.files??1),0),bytes:items.reduce((s,p)=>s+p.bytes,0)}));
const deletePaths=new Set(plans.filter(p=>p.tier==='A'||p.tier==='B').map(p=>p.path));
const targetLinks=a.links.filter(l=>deletePaths.has(l.to));
const brokenLinks=targetLinks.filter(l=>!deletePaths.has(l.from));
fs.writeFileSync(path.join(dir,'affected-document-links.json'),JSON.stringify(brokenLinks,null,2));
fs.writeFileSync(path.join(dir,'cleanup-summary.json'),JSON.stringify({summary,groups,oldDocs:[...oldDocs],affectedLinks:brokenLinks.length,linksInDeletedDocuments:targetLinks.length-brokenLinks.length,plans},null,2));
console.log(JSON.stringify({summary,groups,oldDocs:[...oldDocs],affectedLinks:brokenLinks.length},null,2));
