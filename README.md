# Traffic Jam

React、Vite 與 Three.js 製作的 6 × 6 移車解謎遊戲。畫面採真正的 3D 模型與光影，規則維持格位式移車：紅車從第 3 列右側離開，一次有效拖曳算一步。

## 功能

- 40 個正式關卡、四種難度、步數、復原、重置與下一關。
- 背景 Worker 最短路徑搜尋、提示、最佳步數與星級評分。
- 自訂關卡編輯器：兩次點選空格放車、選取車輛後移除、驗證、儲存與試玩。
- 九種 Blender 車型：跑車、越野車、皮卡、小轎車、計程車、校車、巴士、露營車與貨運卡車；依車色與長度對應。
- 奶油色厚地台、瀝青紋理、淡輪胎痕、排水溝、立體護欄、出口道路與升降閘門。棋盤外的管理亭、盆栽、交通錐與路燈放在連續的微縮基座上。
- 車漆與玻璃加入一次產生的環境反射；輪胎依移動距離轉動，起停輕微晃動，阻擋時懸吊回彈。倒退亮倒車燈、停住短暫亮煞車燈；四輪保留單一材質批次，以著色器轉動。
- 暖陽、黃昏、霓虹夜景；完成不同的 10 / 20 個正式關卡解鎖後兩種場景，自訂關卡與重複通關不增加解鎖數量。場景選擇保存於瀏覽器。夜景以發光材質及光池呈現，沒有新增投影光源。
- 思考時周邊偶有落葉；通關先抬閘門再加速出場，鏡頭輕微跟隨，最佳步數通關另有彩帶。減少動態偏好會跳過裝飾動畫。沒有加入聲音。
- 怠速排氣、車燈明暗、拖曳煙霧與快速滑動火花；紅車實際駛出出口後顯示通關結果。
- 拖曳時以 13% 不透明度標示整段合法移動範圍，放手後隱藏；選取車輛不會留下舊位置框。
- 拖曳與通關最多 60 FPS、待機動態最多 30 FPS；陰影採 1024px 並在移動時最多每秒更新 30 次。DPI 上限 1.5，離屏或背景頁籤停止繪製，減少動態偏好的靜止畫面不重畫。
- 「視角與光源」可調俯視角 45–80°、左右觀察 ±35°、主光源方向與亮度、投影陰影。預設 65°，設定會保存於瀏覽器。
- Raycaster 命中真實車身，拖曳座標反算至地面；視角改變後仍沿原格位移動。
- 車輛選取按鈕搭配方向鍵操作。支援減少動態效果，WebGL 無法使用或中斷時切回 CSS 2.5D。
- 通關紀錄、自訂關卡與視覺設定使用 localStorage；清除網站資料會移除，不跨裝置同步。

## 運行與打包

需要 Node.js 24 與 npm。依賴版本由 package-lock.json 固定。

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```

開發網址預設 http://localhost:5173。Windows PowerShell 若限制 npm.ps1，改用 npm.cmd。手機與電腦連同 Wi-Fi，使用開發伺服器顯示的 Network URL 即可測試。

3D 模組以動態 import 載入，GLB 素材另外下載。Three.js 模組仍超過 Vite 的 500KB 提醒門檻；目前沒有離線快取。手機加入主畫面由 manifest 支援，尚無 Service Worker。

## Blender 素材

`art/toy-garage.blend` 是可編輯的模型原始檔，包含停車場與九種車型。遊戲讀取 `public/models/` 的 GLB，修改 .blend 不會直接更新遊戲；需將對應模型匯出為相同檔名的 GLB。保留車型尺寸、原點、Paint 材質名稱，以及 GLB 的 Y-up 轉換。Rolling wheels 材質批次需保留頂點色；本地四輪中心依車長、固定輪距與 .19 格輪半徑設定於 garageMaterials.js。若改變輪距或半徑，需同步修改動畫參數。

`scripts/build_models.py` 可用 Blender 4.5 重新產生全部素材：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python scripts/build_models.py
```

重新產生會覆寫 .blend 與 GLB。若已手動修改，先另存原始檔，或將修改整合回產生腳本。車型沿本地 X 軸向前；Blender Z-up 匯出後為 Three.js Y-up，長度 2 或 3 格、寬度小於 1 格。

## 驗證

`npm test` 檢查移動規則、解題路徑、評分、40 關資料，並解析九個 GLB 檢查尺寸、地面高度、Paint 材質及所有關卡的車型長度對應。GitHub Actions 在 PR 與 main 更新時測試和打包。素材測試亦檢查四輪頂點色與旋轉中心，場景測試檢查解鎖門檻及排除自訂／無效進度。

`scripts/check-vehicle-hits.js` 在載入遊戲的瀏覽器中執行：3D 模式檢查每台車三個車身位置的射線命中；2.5D 備援檢查五個表面位置與棋盤軸線。

```powershell
agent-browser --session traffic-jam open http://localhost:5173
Get-Content scripts/check-vehicle-hits.js -Raw | agent-browser --session traffic-jam eval --stdin
```

`scripts/check-scene-performance.js` 可同樣透過 eval --stdin 在靜止的 3D 關卡執行，檢查待機影格上限、陰影快取與離屏停止及恢復。此輪相同環境 3 秒待機繪製呼叫從 22,841 降至 5,964；此數據代表測試環境，並非所有裝置的 FPS 保證。水平與直向拖曳範圍及優化後第一關九步通關已以滑鼠驗證。

此瀏覽器檢查需另行執行，仍需實際拖曳與通關驗證。本輪已在 45° / 35° 視角以滑鼠完成第一關九步通關，於 375px 畫面建立並試玩自訂關卡，檢查 320px / 80° / -35° 車身命中、設定保存、鍵盤移車、復原及 WebGL 中斷備援。本輪另以滑鼠確認倒車燈、煞車燈、輪胎角度及完美通關彩帶／鏡頭跟隨，以隔離測試資料確認 10 / 20 關解鎖和場景保存。55° / 35° 夜景的 375px 命中與無橫向溢出通過，待機影格上限、陰影快取及離屏停止保持通過。尚未以實體手機驗證觸控與效能。

## 程式結構

- `src/main.jsx`：遊戲畫面、關卡、操作與編輯器。
- `src/Board.jsx`：3D 畫布、載入備援與視角光源設定。
- `src/garageScene.js`：Three.js 攝影機、模型、光影、命中、拖曳及動畫。
- `src/Board2D.jsx`：CSS 2.5D 備援棋盤。
- `src/vehicleModels.js`：車色與長度對應車型。
- `src/garageMaterials.js`：程序紋理與合批車輪的著色器動畫。
- `src/sceneThemes.js`：場景光照與正式通關解鎖條件。
- `src/GameUI.jsx`：按鈕圖示、通關結果與焦點處理。
- `src/gameEngine.js`：格位規則、驗證、搜尋與評分。
- `src/solverClient.js` / `src/solver.worker.js`：可取消的背景解題。
- `src/storage.js`：進度與自訂關卡。
- `src/styles.css`：桌面與手機介面。
- `public/levels/`：40 個關卡與索引。
- `public/models/`、`art/`、`scripts/build_models.py`：遊戲素材、Blender 原檔與產生腳本。

開發分支透過 PR 審查後合併；GitHub origin 為 https://github.com/TFCChen/traffic-jam-game-1.git。Vercel 發布後需確認部署結果。

## 介面、收藏與畫質

棋盤預設佔據主要畫面，操作列在棋盤下方；關卡、分析、自訂關卡與收藏集中於抽屜。車庫設定另有抽屜，可用 Esc 或背景關閉，並恢復原按鈕焦點。手機版保留安全區與 44px 主要操作按鈕。

畫質提供精緻（DPR 上限 2、2048 陰影）、標準（1.5、1024）及省電（1、關閉陰影／裝飾待機動畫，拖曳上限 30 FPS）。偏好仍存於瀏覽器。觸控先判定真實模型；沒命中時才以投影車身周邊 12px 容錯，放手約 0.42 格即可吸附，合法移動範圍不變。

收藏包含首次通關、三星、最佳步數、十關與四十關徽章；黃昏／夜景依十關／二十關解鎖。新收藏顯示於通知與通關結果，重玩不重複增加。既有紀錄保留，最佳步數徽章從本版實際完成的最佳解開始記錄。

`node scripts/verify-touch.mjs <CDP-WebSocket-URL>` 可在開啟 localhost:4173 的隔離 Chrome 測試瀏覽器中，透過真實觸控事件驗證容錯、吸附、取消、三檔畫質、九步通關與第十關解鎖；完成後還原進度／偏好。此為模擬裝置測試，實體手機仍待驗證。

## 後續方向

實體手機觸控與效能調整、新手教學、自訂關卡匯入匯出、圖示與離線遊玩。
