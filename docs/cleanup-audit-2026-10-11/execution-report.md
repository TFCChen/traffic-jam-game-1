# 核准清理執行紀錄 — 2026-10-12

使用者明確授權依已列出報告執行安全刪除，除必要情況不備份。本輪沒有建立備份；保留 Git 歷史、REVIEW／KEEP及使用者附件。

## 刪除結果

- 基準：feature/game-feel／9e6ad3e72dd9c778d7f7d2b40eed8c2911768a7e；遊戲版本1b806bc4。
- 僅依原始A/B清單，刪除2148目標、38384檔、8,721,155,474bytes（8.72GB／8.12GiB）。
- 刪前逐項確認檔案數／大小一致；檢查絕對路徑均在專案且沒有reparse link，沒有程序使用指定profiles或npm下載快取。逐項使用PowerShell LiteralPath刪除，無跨shell刪除或git clean。
- 移除專用測試Chrome profiles、歷史逐格媒體／量測輸出、npm下載快取、16組已廢除方案文件、舊動物製作記錄及verify-stages.mjs。
- 保留全部src/public、五個Blend、現用動物來源、有效工具、CI／測試、附件、剩餘來源／基準工具、node_modules、dist及.git。
- README／HANDOFF整理成目前狀態與設計決策，保留否決理由；修正100處歷史媒體連結，歷史報告標記原始證據已清理。新增docs索引。

## 驗證

- [408個保留檔案SHA-256核對](verification-result.json)：全部一致，含全部src/public、素材來源、有效工具、附件及REVIEW來源／模型基準。A/B目標剩餘0，Markdown相對檔案連結失效0。
- 專案實體檔案內容長度由10.13GB降至約1.41GB（含新清理報告約3.3MB；不跟隨baseline/node_modules連結）。docs由877.77MB降至約21.5MB，包含45個原有代表媒體、文字／數據及本次清理紀錄。實際Git metadata可能隨提交略增；本輪未改寫Git歷史。
- npm test全部17組通過；npm run build成功，包含40關解答重播及73個版本化離線資源。保留既有Vite單chunk超過500KB提醒。
- localhost:4173/version.json=1b806bc4，與清理前一致；重建後重新載入實際頁面。
- 隔離測試origin 127.0.0.23：桌面1280×720夜景，空白編輯器兩端放紅車、驗證／試玩／實際拖曳、自然出庫、動物結算、關閉／重開結果及再玩一次正常。
- 手機尺寸390×844雨景：自然出庫、結果卡片／八隻動物、返回編輯器及返回正式02關零步正常。console warn/error空。恢復夜景90°／0°／100%與原視窗，保留4173服務及平常origin進度。
- 這是清理回歸，沒有重做全部主題／鏡頭、正式第一關九步或真機效能測量。原遊戲程式／素材雜湊一致；未調整功能或設計。
- GitHub既有browser-ci失敗根因尚未定位；不能由本機test/build通過推論遠端CI全綠。本次只清理文件／歷史資料，未更動CI／測試。

![清理後手機尺寸雨景通關結果](mobile-rain-result.png)

本輪依核准計畫以新提交推送feature/game-feel，維持原測試網址；main保留9e6ad3e里程碑。部署完成狀態以Vercel對該清理提交的READY及固定網址version.json查驗，不以單純push成功代替。

## 查驗資料

[核准計畫](README.md) · [逐檔清單](cleanup-manifest.csv) · [刪前檢查](execution-preflight.json) · [逐項刪除結果](execution-result.json) · [保留檔案SHA-256](protected-file-hashes.json) · [文件整理結果](document-cleanup-result.json)

清單中的存在狀態／大小是執行前快照，不作未來版本的自動刪除授權。已追蹤檔案的刪除可由Git歷史恢復；本機快取及未追蹤驗證原檔已依授權刪除，沒有另作備份。Git歷史約1.1GB保留，因此本輪不會讓Git完整歷史或玩家下載量減少8GB。
