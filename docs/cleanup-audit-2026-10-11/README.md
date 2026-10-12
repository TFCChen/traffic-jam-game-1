# 專案完整清理盤點 — 2026-10-11

**結論：主要負擔是測試瀏覽器資料與歷史驗證媒體，並非現用遊戲素材。** 建議清理 A 與 B 類共 **8,721,155,474 bytes（8.72 GB／8.12 GiB）**，約占目前資料夾 86.1%。以下是執行前的核准計畫快照；A/B 已於2026-10-12按使用者授權執行。最新結果見 [執行紀錄](execution-report.md)。

基準：`feature/game-feel`、`9e6ad3e72dd9c778d7f7d2b40eed8c2911768a7e`；本機與遠端 main 已同步此提交。使用者最新確認手機結算問題未再出現。既有 README 修改、HANDOFF、使用者附件與未追蹤檔均保留。

## 盤點範圍與方法

- 遍歷檔案 metadata，共 **43,046 個檔案、10,130,238,593 bytes（10.13 GB／9.44 GiB）**。統計為檔案內容長度，非磁碟實際配置區塊大小；未計空目錄與本次新報告。
- 含隱藏資料夾、Git metadata、依賴、快取、public、src、scripts、art、docs、附件。跳過 `.browser-checks/baseline/node_modules` 連結，避免把連結目標重複計算或未來誤刪。
- 比對 Git tracked／untracked／ignored 狀態；從 `src/main.jsx` 追蹤相對 import、CSS、JSON、worker URL，檢查 npm build/test 與 CI 入口、Blender 產模鏈及 public 資源配置。
- 對專案內圖片、影片、GLB、Blend 做 SHA-256 完全相同內容比對；未對瀏覽器快取內部檔案或整個 Git 物件庫做內容去重。
- 檢查 Markdown 相對連結、腳本讀檔用途及輸出路徑。盤點時文件現有可解析相對連結沒有失效；執行 A/B 方案會影響 **100 個仍保留文件的連結位置**（另59處隨舊文件刪除，不需修正），必須同步整理。
- 唯讀程序快照：沒有程序命令列引用 `.browser-checks`；4173 preview 程序仍在使用正式 `dist`。這是當時快照，真正刪除前仍需重查。
- 沒有執行舊驗證、產模或建置腳本；沒有改遊戲行為，因此沒有為文件盤點重跑遊戲測試。沒有進行逐函式死碼／逐條 CSS 覆寫分析；不能把「每個檔案有引用」解讀成每個函式或 CSS 都必然需要。

## 現在空間花在哪裡

以下 GB/MB 採十進位，避免與 GiB/MiB 混用。

| 類別 | 檔案數 | 大小 | 判斷 |
| --- | ---: | ---: | --- |
| `.browser-checks/` | 36,233 | 7.864 GB | 最大清理來源，但內含少量唯一工具／基準，不可整包刪 |
| `.git/` | 340 | 1.100 GB | 完整版本歷史，保留 |
| `docs/` | 2,178 | 877.77 MB | 大多為歷史截圖與影片，可大幅瘦身 |
| `.npm-cache/` | 403 | 125.51 MB | 可重新下載的 npm 快取 |
| `node_modules/` | 3,587 | 69.92 MB | 可重裝，目前開發要用，先保留 |
| `art/` | 17 | 48.10 MB | 主體為 Blender 來源，保留 |
| `dist/` | 74 | 16.47 MB | 可重建，但 localhost 正在服務，現在保留 |
| `public/` | 68 | 15.32 MB | 現用模型、關卡、動物與 PWA 素材，保留 |
| 使用者附件 | 3 | 12.55 MB | 原始參考與問題錄影，先保留或另存 |
| `src/` | 66 | 0.54 MB | 全部保留 |
| `scripts/` | 66 | 0.46 MB | 工具幾乎不占空間；只明確標出一個過時驗證 |

## A 類：可以安全清除的可重建／一次性資料

「安全」指不改變目前遊戲、關卡、模型或建置邏輯；仍會失去這些舊驗證原始資料。附帶操作條件不等於已刪除。精確路徑、大小及條件見 [cleanup-manifest.csv](cleanup-manifest.csv)，篩選 `tier=A`。

| 項目 | 範圍 | 大小 | 條件／原因 |
| --- | --- | ---: | --- |
| 專用測試 Chrome profiles | 45 組，33,782 個檔案 | **7.349 GB** | `Local State`／`Default` 識別；關閉使用該 profile 的程序後可清。清的是專案內合成測試資料，不是玩家平常瀏覽器存檔 |
| 暫存擷取、舊診斷輸出 | `.browser-checks` 中清單指定的逐格錄影、截圖、量測輸出、config/target、日誌；2,258 個檔案 | **387.28 MB** | 不含來源腳本、GLB 比較基準、下載參考 PDF、baseline 副本或 video-tools |
| 未被 Markdown 連結指向的歷史驗證媒體 | `docs` 中逐檔列出的 1,324 個原始圖／影片 | **794.63 MB** | 已檢查不是遊戲、建置或測試讀取的輸入；有些在報告純文字中被提及，仍應精簡證據敘述 |
| npm 下載快取 | `.npm-cache/`，403 個檔案 | **125.51 MB** | 沒有 npm 安裝正在執行時清除；之後可能重新下載，不影響現有 node_modules |
| Python 快取與舊產模日誌 | `scripts/__pycache__/*`、`art` 中清單指定 `.log`；9 個檔案 | **49.39 KB** | 不是原始碼或模型，可重建 |

A 類合計：**37,776 個檔案、8.656 GB**。45 組 profile 的完整路徑已展開於 CSV，並非以萬用字元刪除整個 `.browser-checks`。

## B 類：遊戲不需要，可連同文件整理後移除

B 類 **608 個檔案、65.06 MB**。刪除這些檔案不會回復任何被否決玩法；它們是留下來的舊紀錄，相關 runtime 模組早已移除。

### 已廢除方案的 16 組文件資料夾

下面每一個路徑都列入清單，合計 **519 個檔案、45.57 MB**。刪除前在精簡交班保留「已否決、不要恢復」的原因；其餘文檔中指向這些位置的連結一併調整。

| 路徑 | 被取代／廢除的內容 |
| --- | --- |
| `docs/traffic-night-2026-10-10/` | 第一版場外路過車流 |
| `docs/traffic-variety-2026-10-11/` | 多車款車流／裁切實驗 |
| `docs/traffic-offscreen-2026-10-11/` | 車流畫面外端點／道路延伸 |
| `docs/street-integration-2026-10-11/` | 已撤回的追加道路整合 |
| `docs/street-passages-2026-10-11/` | 兩端建築遮擋方案 |
| `docs/street-gardens-2026-10-11/` | 已否決的屋頂花園／木平台 |
| `docs/tunnel-refinement-2026-10-11/` | 隧道量體修整 |
| `docs/tunnel-foundation-2026-10-11/` | 已移除隧道的底座修正 |
| `docs/tunnel-polish-2026-10-11/` | 已移除隧道／斜降側翼美化 |
| `docs/tunnel-symmetry-2026-10-11/` | 已移除隧道的主體統一 |
| `docs/tunnel-details-2026-10-11/` | 已移除隧道的小裝飾 |
| `docs/celebration-review/` | 舊版重複三動物造型 |
| `docs/peek-celebration-review/` | 已被參考動物取代的 SVG 動物 |
| `docs/plush-celebration-review/` | 已被參考動物取代的舊毛絨動物 |
| `docs/celebration-cohesion-review/` | 已否決的桌面動物收進中央框 |
| `docs/stages-2026-10-07/` | 包含已否決的先選車型／方向編輯器；有用的後續行為留在目前交班／測試 |

這裡不刪 `docs/street-restore-2026-10-11` 的精簡報告與拼圖，因為它記錄了最終恢復原街景的正確狀態。也不刪目前螢幕邊緣動物、參考動物的代表圖。

### 其他可整理後移除

- **86 個舊文件有連結的圖片／影片，19.48 MB**：逐檔列於 CSV；刪圖並同步移除／替換報告內失效連結。[affected-document-links.json](affected-document-links.json) 列出受影響的來源文件與目標。
- **`art/plush-mascots/README.md`、`art/plush-mascots/prompts.json`，4.90 KB**：是淘汰動物的製作紀錄。保留現用 `art/reference-mascots`；舊方案可從歷史提交 `b6d94b1` 找回。
- **`scripts/verify-stages.mjs`，9.92 KB**：仍要求不存在的 `.editor-vehicle-cards`、`.editor-orientation`、`.win-up-next`，且 `browser-ci.mjs` 未呼叫它。可以隨舊 stages 報告移除。名稱相似的 `verify-stage-models.mjs` 是模型檢查，不列入安全刪除。
- 空的 **`art/watercolor-mascots/`、`.tmp/`** 可刪目錄本身，釋放容量記為 0；未包含在檔案數與 bytes 合計。

## C 類：先保留或另存，不能稱為直接安全刪除

CSV 用 `tier=REVIEW`，合計 **3,859 個檔案、226.96 MB**（含依賴／建置產物）。

- **使用者上傳的兩張動物參考與手機問題錄影**：`.codex-remote-attachments`，12.55 MB，未提交，Git 無法找回。可另存到專案外參考資料區，但不應和 AI 驗證截圖一起刪。
- **`.browser-checks` 的 23 個一次性程式／HTML**：如 `deduplicate-fence.py`、`separate-fence.py`、`rebuild-fence-only.py`、`refine-delivery.py`、`remove-passage.py`、`update-courtyard.py`、`raster-icon.html`。目前沒有納入 Git，可能是唯一修模／產圖步驟。建議先整理需要的來源進工具區或另存，再決定淘汰哪些。
- **舊模型基準**：`base-garage.glb`、`plinth-before.glb`、`racer-before.glb`。其中 `verify-perimeter-depth.mjs` 明確預設讀取 `plinth-before.glb`；不是一概無引用。先找出對應 Git 提交並改成可重建基準，或決定不再重跑 AB 比較。
- **`baseline/`、`baseline.zip`、`street-source-backup/`**：先比對 Git 版本與是否有唯一修改。其中 baseline 有 node_modules 連結，不可遞迴跟隨清除到工作專案依賴。
- **`video-tools/`**：額外影片工具，可重用；不屬於必須立即刪的舊媒體。
- **`ferrari-296-reference.pdf`**：車型設計參考，可另存，尚無理由認定永遠不再使用。
- **`dist/`**：建置可重生，但 4173 現在讀取它；本輪清理不應讓 localhost 失效。
- **`node_modules/`**：能重裝，僅69.92 MB；保留不妨礙此次大幅瘦身。
- **兩個根目錄 preview 日誌**：目前皆 0 bytes，服務可能仍持有檔案，沒有清除價值。

## 必須保留的內容

- **全部 `src`**：66 檔，包括17組測試；49個非測試檔都能由入口追到引用。沒有發現整份孤立、可直接刪的 JS／JSX／CSS。2D fallback、solver worker、陰影／雨景／車燈模組都不是廢案。
- **全部現用 `public`（68 檔）**：10個 GLB（9車型＋車庫）、40關＋index／solutions、8個參考動物、PWA manifest／圖示／開發恢復 worker。模型以動態名稱載入，不能只搜尋完整檔名就判未用。
- **`public/sw.js`**：雖然正式 build 會覆寫，原檔有 localhost 舊離線快取恢復用途，保留。
- **`public/icon-maskable.svg`**：目前 manifest 使用 PNG，但 SVG 可作圖示來源；沒有必要為幾 KB 刪原始圖。
- **5個 Blender來源**：`art/racer.blend`、`compact.blend`、`jeep.blend`、`street-courtyard.blend`、`toy-garage.blend`。尤其 toy-garage 是全資產集合，不能因檔名舊就刪；部分商用車沒有獨立 blend，先保護可編輯來源。
- **現用動物製作記錄與工具**：`art/reference-mascots/*`、`scripts/prepare-plush-mascots.py`。工具名仍帶 plush，但現用 reference 動物 metadata 也由它製作。
- **建置／CI與產模鏈**：`package*.json`、`vite.config.js`、`vercel.json`、`.github`、`build-offline.mjs`、`precompute-levels.mjs`、`browser-ci.mjs`、`cdp-test.mjs`、4個CI呼叫的verify腳本、產模／壓縮／植被／細修工具及其fixtures。Python模組以名稱import，不能因沒有出現完整 `.py` 檔名就刪除。
- **63個保留工具檔**：清單逐項列出。部分是手動回歸測試，未被 npm 直接呼叫仍可能有用；可日後統整輸出路徑與入口，僅約421 KB，不是容量主因。
- **根目錄 README、HANDOFF、PWA安裝說明**：需要精簡／更新，而非整份刪掉。目前HANDOFF有多段過期狀態，建議整理成「現在版本、已接受偏好、否決方案、開發部署流程、已知CI問題」，保留必要資訊即可。
- **45個精選驗證媒體、其他有用文字／數據**：保留量約18.10 MB，`docs` 可由877.77 MB縮到約18.10 MB；保留螢幕邊緣動物、頭燈拼圖、街景恢復、穩定陰影與最新結算證據。
- **`.git/`**：完整回退能力。`git count-objects` 約1.00 GiB packed history；另觀察到4.43 MiB暫存Git物件。這些不在刪除清單，不手動刪物件，也不為清理重寫已分享歷史。

## 完全重複的圖片

SHA-256 找到 **9組完全相同內容**，多餘副本總計 **7,717,737 bytes（7.72 MB）**。大多是不同輪驗證沿用的 reduced-result／rain-saver 圖。詳細路徑在 [inventory.json](inventory.json) 的 `duplicates`。

例如 camera-corner 與 camera-pivot 的 `gameplay/reduced-result.png` 相同；rain-motion、rain-quiet、rain-visible 多輪的 reduced-motion／rain-saver 也有相同副本。這些已計入 A/B 的媒體建議，**不能再額外加7.72 MB到總釋放空間**。

## Git、本機與Vercel的差別

- A/B 中 **1,640個已追蹤檔案、843.89 MB**：可由目前提交恢復；清理時以新的刪除提交保留歷史。
- A/B 中 **292個未追蹤檔案、15.80 MB**：沒有Git備份，若想保留原始證據須先另存。
- 其餘約 **7.86 GB** 為本機ignored快取／輸出。它們本來就不在GitHub；刪掉主要節省電腦空間，聊天室未提交數量不會按這些檔案數同比下降。
- 刪除 tracked 歷史圖片的新提交會縮小「最新checkout」，**不會抹除先前提交中的大檔案**；Git下載歷史仍可能接近1.1 GB。若日後要壓縮完整歷史，需要另外規劃，不在此方案內。
- Vite部署內容目前約16.47 MB，主要從src／public產生。清理docs／本機profiles不會讓玩家下載量減少8 GB，也不改原測試網址。

## 建議執行順序

1. 固定本次清單與Git基準，必要時另存未追蹤資料；不使用 `git clean -fdx`、`git add .` 或整個.browser-checks刪除。
2. 清A類profiles、npm cache、一次性輸出。刪除前重新確認專用程序、絕對路徑與連結目標；保留4173與dist。
3. 精簡HANDOFF為現況／設計偏好，保留已否決方案的警示；同步刪B類廢案紀錄與100處連結影響。
4. C類先另存或統整工具，未確認者留在原處。
5. 執行npm test、正式build／40關重播、檢查文件連結與代表畫面；只提交本輪清理，推送feature/game-feel，確認Vercel READY與版本。既有browser-ci失敗獨立追查，不能靠刪測試或移除workflow來假裝通過。
6. main保留已確認的里程碑；此次清理若要同步main，再依使用者安排處理。

## 完整附表

- [cleanup-manifest.csv](cleanup-manifest.csv)：**每個專案檔案／每組大型快取**的建議、大小、Git狀態、原因及條件。A/B是刪除建議、REVIEW需保留或再查、KEEP保留。
- [project-files.csv](project-files.csv)：不含Git／快取／依賴／dist的完整實體檔案清單。
- [directory-sizes.csv](directory-sizes.csv)、[docs-directories.csv](docs-directories.csv)：目錄容量。
- [affected-document-links.json](affected-document-links.json)：清理後需修正的100個相對連結位置。
- [inventory.json](inventory.json)、[cleanup-summary.json](cleanup-summary.json)：統計、引用、完整分類與重複內容比對。
- [inventory.mjs](inventory.mjs)、[classify.mjs](classify.mjs)：唯讀盤點與分類來源；只寫本報告資料夾，**不含刪除動作**。依賴 Node24。不要把靜態分類規則直接當成未來版本的刪除授權。

A/B 原檔已按核准清單刪除；REVIEW／KEEP保留。以下附表仍保留盤點時的大小／存在狀態，實際結果以 [執行紀錄](execution-report.md) 為準。


## 執行附表（2026-10-12）

[execute-cleanup.ps1](execute-cleanup.ps1) 僅執行本次已核准A/B快照；刪前檢查絕對路徑、連結、程序及每項檔案數／大小，任一不符即停止。它不是未來的通用清理命令，也不能在已刪除後直接重跑。

[execution-preflight.json](execution-preflight.json) · [execution-result.json](execution-result.json) · [protected-file-hashes.json](protected-file-hashes.json) · [finalize-documents.mjs](finalize-documents.mjs) · [document-cleanup-result.json](document-cleanup-result.json)
