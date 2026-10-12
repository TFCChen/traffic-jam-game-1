# Traffic Jam

React、Vite 與 Three.js 製作的單人 3D 移車解謎遊戲。6 × 6 棋盤、40 個正式關卡；車輛只能沿自身方向滑動，讓紅車從第 3 列右側出庫。

接續開發請先完整閱讀 [HANDOFF.md](HANDOFF.md)，了解目前分支、已接受設計、已否決方案及驗證限制。

## 遊戲功能

- 四種難度、步數、復原、重開、背景 Worker 最短解提示與星級評分。
- 空白草稿編輯器：點兩個端點放車，可換同長度車型、驗證、試玩、儲存及匯入／匯出備份。
- 九種可旋轉欣賞的車模、街區場景、車輪滾動／轉向、懸吊、日行燈、倒車燈與煞車燈。
- 暖陽、雨後、黃昏、霓虹夜景。黃昏／夜景分別以 10／20 個不同正式關卡通關解鎖。
- 紅車出庫演出、柔焦結算背景、八隻從螢幕邊緣探出鼓掌的小動物。
- 精緻／標準／省電畫質、減少動態偏好、鍵盤移車及 WebGL 不可用時的 2.5D 備援。
- localStorage 保存進度、草稿和偏好；版本化 PWA 快取支援首次載入後離線遊玩。沒有雲端進度同步或音效。

## 執行與驗證

需要 Node.js 24 與 npm，依賴由 package-lock.json 固定。Windows PowerShell 可使用 npm.cmd。

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

開發服務預設 5173；preview 預設 4173，讀取 dist，修改程式後要重新 build。build 包含 40 關解答重播與離線資源產生。17 組測試涵蓋規則、模型、鏡頭、編輯器、車身／燈光、出庫、陰影及雨景。人工驗證仍需實際拖曳、通關與查看畫面。

GitHub Actions 在 main／feature/game-feel 推送及 pull request 時執行 test/build，並以四個獨立工作驗證編輯器／離線更新、存檔備援、鏡頭手勢及四十關實際拖曳。完整狀態以 [GitHub Actions](https://github.com/TFCChen/traffic-jam-game-1/actions/workflows/ci.yml) 為準；[啟動與過期測試修復紀錄](docs/ci-repair-2026-10-12.md)。CI 大量重播採省電畫質，不代表實體手機效能測量。Three.js bundle 仍有 Vite 500 KB 提醒。

電腦右鍵旋轉，中鍵或 Shift＋右鍵平移，滾輪縮放；手機在停車場外單指旋轉、雙指平移與捏合縮放，車身單指移車。預設正上方 90°／yaw 0°／100%，可調俯仰 30–90°、縮放 65–400%。已存偏好保留。

[PWA 安裝指南](docs/PWA-INSTALL.md) · [開發與驗證文件索引](docs/README.md)

## 素材與程式入口

遊戲讀取 public/models 的 10 個 GLB、public/levels 的關卡及 public/reference-mascots 的八張 WebP。可編輯來源在 art；修改 .blend 後仍須匯出 GLB。

- art/toy-garage.blend：九車型來源集合，含沒有獨立 blend 的車型，必須保留。
- art/racer.blend、compact.blend、jeep.blend：精修短車；art/street-courtyard.blend：街區。
- [現用動物製作記錄](art/reference-mascots/README.md)：提示詞與來源對照。
- src/main.jsx／Board.jsx／garageScene.js：遊戲流程、3D 容器與渲染。
- src/gameEngine.js／solver.worker.js：規則與解題；src/GameUI.jsx／CheeringAnimals.jsx：結算。
- scripts：產模、建置、離線資源、回歸及量測工具；詳見 HANDOFF。

Blender 4.5 單車重建範例（會覆寫該車來源及 GLB，先檢查腳本能否保留目前精修）：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python scripts/build_models.py -- --vehicle racer
```

不要直接執行未篩選的舊全量產模流程；它可能覆寫已打磨車型與街景。保留尺寸、原點、前向 X、GLB Y-up、Paint 材質及車輪頂點色／批次慣例。

## 分支與清理

目前持續在 feature/game-feel 開發，main 保存 2026-10-11 同步的穩定里程碑。

[固定測試網址](https://traffic-jam-game-1-git-feature-game-feel-tfcc-hen-s-projects.vercel.app) · [正式網址](https://traffic-jam-game-1.vercel.app) · [GitHub](https://github.com/TFCChen/traffic-jam-game-1)

2026-10-12 已按核准安全清單移除歷史驗證媒體、專用測試 profiles、下載快取及廢案文件；保留遊戲程式、素材、模型來源、有效工具、使用者附件與 Git 歷史。[清理計畫及逐檔清單](docs/cleanup-audit-2026-10-11/README.md) · [執行與驗證紀錄](docs/cleanup-audit-2026-10-11/execution-report.md)
