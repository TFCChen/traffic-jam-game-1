# 通關瞬間卡頓修正 — 2026-10-11

正式版本 `ddb2e82d`，原分支 `feature/game-feel`。

上一版為保留街景，在renderer.render後同步呼叫全解析度canvas.toDataURL('image/png')。實際通關量測兩次為272.2／262.6ms（1600×900），會阻塞主執行緒，符合使用者描述的停頓；之後還需由img解碼PNG。

改為直接drawImage至最長邊640px的離屏2D canvas，結果元件在useLayoutEffect將已畫好的canvas接入DOM，首個結果畫面繪製前就有背景；不做PNG壓縮、base64字串或img解碼。只在通關擷取一次，背景的模糊／亮度／比例與300ms動物延遲沿用，保留原路線、淡出遮蔽、車輛回收／鏡頭回正、結果就緒前鎖定與跳過流程。關閉結果時移除canvas節點，重開沿用同一張；重玩／換關／離開試玩仍由原狀態清理釋放。不增加全域快取、燈光或Three.js貼圖。

## 計時證據與限制

- [舊擷取計時](baseline-timing.json)：診斷版eb7d9dcc；PNG262.6／272.2ms。其後緊接的縮小複製0.4／1.0ms是在已完成PNG讀回後測量，**不用這組作單獨新流程的對照**。
- [新流程單獨計時](direct-copy-timing.json)：診斷版186a96b5；不再呼叫PNG，夜景0.7ms、雨景0.3ms（1600×900→640×360）、手機0.4ms（390×844→296×640）。
- 計時範圍為同步背景擷取／複製呼叫，並非整段動畫FPS、GPU完成時間或所有裝置的保證。截圖為間隔取樣，不能宣稱檢查每個GPU影格。
- 正式ddb2e82d已移除暫時performance.now計時與console日誌，只保留直接複製修正。

## 驗證

- 17組npm test成功，正式npm run build成功並重播40關。
- 隔離origin http://127.0.0.23:4173/；兩次PWA更新診斷版，再更新正式版，保留一般origin進度。
- 診斷版：夜景90／0／100連續26張、雨景45／-25／100連續24張、390×844手機雨景90連續29張；背景／暖象牙卡片／八動物效果保留，無全黑空檔。重玩、關閉結果後重新開啟、結果期間桌面轉手機重排正常。
- 正式ddb2e82d：雨景90／0／100連續25張，正常結果、重玩後點擊跳過、返回編輯器成功；console error／warn空。PWA更新後選單版本與dist核對一致；不將診斷版圖冒稱正式版。
- 未重做正式九步通關／下一關、黃昏、省電、最低反向與實機；本輪不改上述流程的時序或車燈。

## 截圖

- [正式版連續畫面](final-rain-contact.jpg)
- [正式版結果](final-result.png)
- [正式版跳過](final-skip.png)
- [診斷夜景連續畫面](measured-night-contact.jpg)
- [診斷雨景連續畫面](measured-rain-contact.jpg)
- [診斷手機連續畫面](measured-mobile-contact.jpg)
- [重開雨景結果](reopened-rain.png)
- [結果期間手機重排](mobile-resize.png)
- [手機結果](measured-mobile-final.png)

原始逐張PNG保留本機；僅提交contact sheets與代表圖。部署狀態與SHA另記根目錄HANDOFF.md。
