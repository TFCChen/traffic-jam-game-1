# Traffic Jam

以 React 與 Vite 製作的 6 × 6 移車解謎遊戲。將紅車移到第 3 列右側出口；一次有效拖曳算一步，跨越多格仍算一步。

## 目前功能

- 40 個正式關卡，保留原有 Beginner、Intermediate、Advanced、Expert 分級與關卡資料。
- 拖曳移車、步數、復原、重置與通關後前往下一關。
- 最短路徑解題器、提示、最佳步數、星級評分與關卡分析。
- 自訂關卡編輯器：兩次點選放置車輛、移除車輛、驗證、儲存、編輯與刪除。
- 通關紀錄與自訂關卡使用瀏覽器 localStorage 儲存；不同裝置不會同步，清除網站資料會移除紀錄。

最新功能承接 `feature/complete-traffic-jam` 分支與 PR #1。原有 40 關已由作者逐關試玩；後續驗收重點是新增功能與手機操作。

## 運行

需要 Node.js 24 與 npm。依賴版本由 `package-lock.json` 固定。

```bash
npm ci
npm run dev
```

預設網址為 http://localhost:5173。Windows PowerShell 若限制 npm.ps1，可使用 `npm.cmd ci` 與 `npm.cmd run dev`。

## 手機測試
手機與電腦連同一個 Wi-Fi 後：
```bash
npm run dev -- --host 0.0.0.0
```
用手機瀏覽器開啟 Network URL。

## 打包
```bash
npm run build
npm run preview
```

手機可用瀏覽器「加入主畫面」。目前只有網頁 manifest，尚未提供 Service Worker 與離線遊玩。

## 測試與開發流程

```bash
npm test
npm run build
```

測試涵蓋遊戲規則、解題路徑、評分與全部 40 關的資料一致性。GitHub Actions 會在 PR 與 main 更新時執行測試和打包。

後續從最新 main 建立功能分支，在本地修改並測試，透過 PR 審查後合併。GitHub origin 為 https://github.com/TFCChen/traffic-jam-game-1.git。是否自動發布取決於 Vercel 專案的 Git 設定，合併後應確認部署狀態。

## 程式結構

- `src/main.jsx`：遊戲畫面、操作、關卡載入與編輯器。
- `src/gameEngine.js`：移動規則、驗證、最短路徑搜尋與評分。
- `src/storage.js`：裝置上的進度與自訂關卡儲存。
- `src/styles.css`：桌面與手機版畫面。
- `public/levels/`：關卡索引與 40 個 JSON 關卡。

## 下一階段

1. 將解題搜尋移到 Web Worker，避免高難度關卡搜尋時阻塞畫面。
2. 加入新手教學、更清楚的方向提示與鍵盤操作。
3. 加入自訂關卡匯入匯出與備份。
4. 補上圖示與 Service Worker，提供離線遊玩。
