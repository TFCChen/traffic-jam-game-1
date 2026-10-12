# Traffic Jam 開發交班

更新：2026-10-12（Asia/Taipei）。接續前完整閱讀本檔，再確認 git status、分支、localhost 與 version.json。

## 目前狀態

- 工作目錄：C:/Projects/traffic-jam-game；持續在 **feature/game-feel** 開發。
- 遊戲版本：**6ac96b60**（撤下已否決的路邊小貓，恢復已接受街景）；上一輪修正6ac96b60；原穩定里程碑為1b806bc4／9e6ad3e72dd9c778d7f7d2b40eed8c2911768a7e。
- main／origin/main 已依使用者要求快轉同步到上述提交，作為穩定里程碑；後續推送 feature/game-feel，原測試網址不變。舊「不要合併 main」記錄已被本安排取代；下一次同步 main 再依使用者要求。
- 撤回提交fa94ffc8已推送；Vercel dpl_3TdNyCr6t3qvA79nkcxq867M3SSQ為READY，固定測試網址version.json=6ac96b60，main未變。本輪CI38214658815尚未完成。以下為上一版歷史。 [固定測試網址](https://traffic-jam-game-1-git-feature-game-feel-tfcc-hen-s-projects.vercel.app) 已部署小貓程式提交ff6abdbb，Vercel dpl_7QmLaN6aYB2mTLQ8nDtBUYW6m4sz為READY，version.json=95b93f5f；透過PWA更新保留原第01關0步。[正式網址](https://traffic-jam-game-1.vercel.app)仍為main穩定版1b806bc4。最新小貓遠端CI見報告，不以過往43項全通過當作本輪結果。
- localhost:4173 是 **Vite preview，讀取 dist**，不是熱更新服務。保持服務可用；src 改動後必須 build。
- 使用者確認手機自然出庫後先前結算卡頓／像跳兩次的問題目前未再出現；開發端僅做桌面瀏覽器及手機尺寸驗證，不代表所有實體手機已測。
- 2026-10-12 CI 修復完成：程式提交02e0b19的 [完整工作38198686693](https://github.com/TFCChen/traffic-jam-game-1/actions/runs/38198686693) 四十三項全部成功：17組測試／build、40關共1,029次實際拖曳、100次切換、編輯器、PWA／離線／WebGL備援、存檔備援與桌面／手機尺寸鏡頭手勢。已修正 Chrome 啟動探測、過期 UI／鏡頭斷言及轉場／視窗／首次載入等待，未改遊戲程式。[CI 修復紀錄](docs/ci-repair-2026-10-12.md)。推送 feature/game-feel 現在也會驗證，40關各自獨立，CI大量重播採省電畫質，鏡頭仍驗證精緻畫質。軟體WebGL工作可能耗時十數分鐘；完整結果仍須查看最新GitHub Actions，不以歷史失敗或截圖代替。gh 讀 job 日誌可能403，但 GitHub connector 可在工作完成後讀取。最後紀錄提交只改文件，以 [skip ci] 避免重複整批測試。

## 已接受方向與不可恢復方案

**路邊程序貓試作95b93f5f已被使用者明確否決，並同意撤下。** 大頭大眼、幾何拼接輪廓及細節不符合現有停車場；已移除其模型程式、專屬測試與環境整合，遊戲src／package.json回到0c72c483內容，17組測試與build通過，版本6ac96b60。不要恢復此貓。後續改找自然比例且授權清楚的模型，先在實際街景驗收靜態外觀，再做動作；目前沒有加入替代品。候選來源、費用與尚未驗證事項見小貓報告。下段試作內容僅為歷史，使用者否決優先。


2026-10-12使用者回報iPhone長玩較熱、S22 Ultra未明顯發熱且基本不卡頓；明確暫不調整發熱設定，接著同意[一隻路邊小貓試作](docs/sidewalk-kitten-2026-10-12.md)。courtyardCat.js獨立生成24骨頭橘白虎斑模型，由courtyardAtmosphere管理；長椅外側有限活動，觀察／撥葉／短跳／舔爪；雨後不追葉；編輯器隱藏，省電與縮減動態靜態。未改原街景模型、畫質、幀率或關卡，沒有新增依賴。此版外觀／動作待使用者驗收，不要擅自擴充小狗。18組本機測試與build通過；新增真實鋪面與完整骨架週期貼地測試。最新部署／CI結果見該報告。

2026-10-12[手機精緻畫質巡檢](docs/experience-audit-2026-10-12.md)發現的三項已依使用者同意修正：低高度結算縮減留白並讓操作區保持可見；settings按實際變更分流，純鏡頭／動態偏好不重設車材質／雨水shader／畫布／世界陰影；有紅車草稿返回後顯示繼續編輯提示，空白提示縮短。844×390結算兩按鈕完整可見且高47px，390×844直式與試玩返回、雨後省電→精緻及陰影關／開、夜景展示角度已本機驗證。17組測試與build通過。程式提交0c72c483的[本輪CI 38203903176](https://github.com/TFCChen/traffic-jam-game-1/actions/runs/38203903176)已43／43全部成功：40關實際拖曳、100次切換、更新／離線／保存與備援；新增鏡頭操作材質版本／反射資源不變、編輯提示及第1／40關844×390與667×375橫式結果檢查皆通過。最後文件提交使用[skip ci]，遊戲程式維持上述完整驗證內容。真機FPS／GPU耗時尚未量測。

單人6×6移車解謎、40關與目前難度維持。使用者以桌遊經驗編關且接受難度；雙人連線只是討論，已決定先維持單人。

目標是精緻、可放大欣賞的車輛／街景，動態可信並兼顧手機效能。滿版場景、炭灰懸浮UI、暖金重點；不要網頁標題介紹、大面積綠面板、大片側欄、重複按鈕或常駐說明。預設精緻畫質、車身動態120%；目前不加音效。

**已整組撤回：路過汽車、後加延伸道路、兩座隧道／遮擋建築。** 使用者認為車輛切面、道路接合、量體與原街景不融合，最後明確要求恢復原街景。維持目前garage.glb道路、護欄、底座及雨景；不要從歷史提交恢復車流、隧道、斜降側翼、屋頂花園或木平台。

**通關動物維持螢幕周圍探入鼓掌。** 使用者接受目前暖象牙結果卡片與八隻動物；桌面收進中央框方案已否決。八種是灰兔、棕山羊、米色乳牛、黃小雞、白綿羊、粉紅老鼠、粉紅豬與棕垂耳狗。保持比例、下半身藏在邊界、不遮結果按鈕。不要恢復舊三動物、SVG／原創毛絨角色。舊毛絨記錄可由歷史b6d94b1找回，只作歷史參考。

現用CheeringAnimals.jsx／cheeringAnimals.css、referenceMascots.json、public/reference-mascots。來源與提示詞在 [art/reference-mascots](art/reference-mascots/README.md)；附件兩張原參考與手機錄影保留。素材是參考生成的獨立圖像，不可把有浮水印的參考直接裁切／去水印作素材。prepare-plush-mascots.py名字雖舊，仍是現用工具。inputs.json外部生成圖路徑跨機器未必存在，public現用素材已提交。

## 必須保留的修正

### 操作與編輯器

- 紅車由第3列右側離開，車輛只能沿自身軸向滑動；一次有效拖曳算一步。最短解worker、復原、星級、自訂關卡、備份匯入匯出保留。
- 鏡頭預設pitch90°／yaw0°／zoom1，限制30–90°及0.65–4；90°up vector、放大角落後旋轉的焦點／平移重新基準化已修。旋轉不自動縮放；垂直拖曳反轉，水平維持。
- 電腦右鍵旋轉、中鍵或Shift＋右鍵平移；手機場外單指旋轉、雙指平移／捏合，車身單指移車。不要改回60°、85°或89°舊預設；已有偏好保留。
- 編輯器開空白草稿；點兩端自動判斷方向及2／3格，可反向畫。首紅車限出口列水平兩格；無效首點不選取，第二點失敗清選取，原格／Esc可取消。
- 非紅車可換同長度車型或移除，紅車不顯示換車。車輛列表緊湊橫向捲動，工具動線「驗證 → 試玩 → 儲存／更新」。試玩結果「再玩一次／返回編輯器」。不要恢復先選車型、方向、長度的舊流程或「返回草稿」名稱。
- 一般拖車無整段合法範圍框；提示保留方向／距離／目的地，取消逐格節點。正常地面深度測試、被擋部分淡虛線約28%，不能蓋在車頂。

### 車輛、街景與光影

- 透明深色反光車窗，保留內裝；不以毛玻璃表現隔熱紙。紅車嵌入式頭燈、輪拱／前輪連接／滿舵穿模／車輪回正已修，改模型要重查。
- 懸吊／轉向是格位規則下的運動學與視覺回饋，不是完整剛體引擎；輪胎貼地、車身獨立樞紐與材料批次保留。
- stableShadowFilter.js固定旋轉Vogel取樣修復Three.js0.186.1螢幕相關PCF黑閃。不可恢復螢幕雜訊取樣，或用過量bias／全關陰影掩蓋。紅車出場及快速拖車陰影同步修正保留。
- 頭燈兩實際光源平行投射、近處柔光與遠處截止線、雙束自然重疊；範圍9.5、夜光強18、投射半角.9、192配光貼圖，四燈／兩256²深度圖。中央不補第三燈；交會暗線已修。這是微縮藝術配光，未做公尺／lux／IES校準。
- 日行燈維持；煞車紅光貼車尾柔散（半徑.85、強度.7、半角1.15、penumbra1、下俯落差.42），燈面信號保留；普通尾燈／倒車分情境，不全常亮。
- 四主題含雨後。瀝青不做鏡子、積水不做黑坑、水珠不過大；不恢復直線路緣流水或強濺水。保留少量植被滴水、風動、落葉、暖光與細緻街景。

### 出庫、結算與演示

- 紅車約4068ms完整出庫，沿原街道駛離；速度、曲率、轉向與車輪回正共同一致。可點畫面跳過，不加常駐跳過提示文字。
- 底層淡出遮罩遮車輛回收及鏡頭回正，不能直接刪。3240ms前擷取已渲染街景作不透明柔焦背景，最長邊640的離屏2D canvas／drawImage，避免同步全解析度PNG編碼；記憶體畫面於重玩／換關清理。
- 卡片280ms淡入上移8px，無縮放回彈；動物延後300ms。結果覆蓋時暫停隱藏WebGL／陰影更新，仍按出庫時鐘只完成一次；關閉恢復。保留縮減動態、2D及讀畫布失敗回退。
- 演出未完成前結果按鈕／Escape暫停，完成後聚焦主操作；關閉／重開／重玩／跳過／返回編輯器狀態一致。
- 首次約4.6秒圖像演示待場景就緒才播，可略過並從選單重看。不要恢復舊多頁教學或冗長文字。

## 開發、素材與部署

React19.2.6／Three0.186.1／Vite7.3.6，ES Modules；Node24。PowerShell用npm.cmd：

```powershell
npm.cmd test
npm.cmd run build
# 4173 已在跑時不要重複啟動；需要熱更新才另開 npm.cmd run dev（5173）
npm.cmd run preview
```

遇舊版先比較UI版本、version.json、服務埠、dist與部署提交。PWA更新保留進度，不直接清網站資料；localStorage尚無雲端同步。[PWA指南](docs/PWA-INSTALL.md)。

主要入口：main.jsx遊戲流程；Board.jsx／garageScene.js渲染命中；GameUI.jsx／CheeringAnimals.jsx結算；gameEngine.js／solverClient.js／solver.worker.js規則提示；useEditorState.js／editorPlacement.js編輯；storage.js／sessionState.js／backupState.js保存；cameraControls.js／exitChoreography.js鏡頭出庫；garageMaterials.js／vehicleGlass.js／vehicleFinish.js車材質；vehicleDynamics.js／vehicleEffects.js／headlightOptics.js動態燈光；stableShadowFilter.js／environmentShadows.js／contactShadow.js陰影；courtyardAtmosphere.js／sceneryAtlas.js環境；groundSurface.js／rainSurfaces.js／rainMotion.js／courtyardReflections.js雨水；OfflineStatus.jsx／build-offline.mjs更新。

public全部68檔保留（10GLB、42關卡JSON、8動物WebP及PWA資源）。art五個Blend保留；toy-garage是全車型集合，部分車型沒有獨立來源；racer／compact／jeep為精修短車，street-courtyard為街區。改blend後要匯出GLB。Blender4.5單車指令：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python scripts/build_models.py -- --vehicle racer
```

不要未篩選就跑舊全量產模；先確認細修流程，否則會覆寫既有成果。保留原點、尺寸、X前向、Y-up、Paint、車輪頂點色／批次。輪距／半徑／中心變更須同步prepareWheels、createWheelShadowGeometry、exitChoreography。scripts手動回歸／量測工具未被npm呼叫不代表無用。

提交前實際遊玩／截圖與適當測試；推送feature/game-feel後查Vercel READY及固定網址version.json。手機尺寸模擬不可說成真機；效能數據標明CPU提交／GPU／整體時長，不用歷史樣本宣稱固定FPS。不要git add .把附件或驗證快取全提交。

## 本次核准清理

使用者已授權按 [清理報告](docs/cleanup-audit-2026-10-11/README.md) 的A/B精確清單刪除，除必要情況不備份。已刪2148目標／38384檔／8,721,155,474bytes，沒有建立備份或改寫Git歷史。保留文件移除失效媒體連結並標明歷史證據範圍。詳見 [執行紀錄](docs/cleanup-audit-2026-10-11/execution-report.md)。

C／REVIEW保留：使用者附件、.browser-checks來源腳本／模型基準／baseline／street-source-backup／video-tools／參考PDF、node_modules、dist及服務日誌。baseline/node_modules是連結，不遞迴跟隨；不可將剩下.browser-checks整包刪。原始逐檔清單與執行紀錄供查驗，不是未來版本通用刪除授權。Git約1.1GB歷史保留，刪checkout圖片不縮小既有Git歷史。

[文件索引](docs/README.md) 優先連結目前街景、動物、頭燈、煞車與最新結算報告。歷史報告保留根因／量測，不代表目前功能待辦；新工作依使用者要求逐項進行，不恢復已否決方案。
