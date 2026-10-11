# 通關銜接驗證 — 2026-10-11

版本 `dc13ba6c`，分支 `feature/game-feel`。

紅車仍沿原路線出庫、轉向並駛離；3240ms 在淡出前保留一張當下已渲染街景，結果卡片接入模糊／壓暗背景。原本遮住車輛回收與鏡頭回正的流程繼續在背後完成，不直接刪除遮罩。動物的進場延後 300ms，造型、尺寸、邊緣構圖與暖象牙卡片不變。正常約4068ms完成後啟用按鈕，避免提早關閉露出回收；跳過操作也先保留當下畫面再完成。保留 reduced-motion、2D 與讀取畫布失敗時的完成回退。

畫面只在每次通關擷取一次，保存在 React 記憶體中，重玩／換關／返回編輯器時釋放；不寫入備份或 localStorage，不新增燈光或GPU貼圖。取樣在 WebGL render 同步完成後，保留 preserveDrawingBuffer=false。

## 本輪實際驗證

- `npm.cmd test`：17組成功，新增卡片接入時車輛仍可見／已轉彎、未開始淡出、保留至少700ms銜接時間的檢查。
- `npm.cmd run build`：成功，40關解答預計算與重播成功。既有大型chunk提示仍在。
- 隔離 origin `http://127.0.0.23:4173/`，PWA「更新並重新開啟」後，選單版本與dist均為dc13ba6c。
- 夜景90／0／100：32張連續畫面；雨景45／-25／100：25張；雨景30／180／65：25張。卡片接上街景，未見原先全黑空檔、車輛回收或鏡頭回正穿透結果背景。
- 390×844手機模擬雨景：正常通關24張、點擊跳過、重玩、Escape關閉、結果開啟期間由桌面縮至手機、返回編輯器均已查。不是實機GPU測試。
- 正式第01關實際九步通關24張，下一關確認第02關零步；試玩結果「再玩一次／返回編輯器」正常，Tab／Shift+Tab在結果按鈕間循環。
- 本origin console error／warn空。React檢查：狀態每次出庫清理、最新回呼由ref轉接、effect計時器清理、disabled按鈕排除焦點循環、結果就緒後聚焦主動作。
- 未重做黃昏／省電／真機，也未在瀏覽器改作業系統reduced-motion設定；縮減動態路徑由原有程式／測試覆蓋。本輪不修改頭燈、日行燈、煞車燈、關卡難度或街景。

## 截圖

連續截圖是間隔取樣，不能聲稱檢查每個GPU影格。下列contact sheet涵蓋本輪取樣；原始逐張PNG留在同目錄本機，僅提交代表圖以控制倉庫體積。

- [夜景連續畫面](night-contact.jpg)
- [雨景斜視角](rain-contact.jpg)
- [最低反向縮小視角](reverse-contact.jpg)
- [手機正常通關](mobile-contact.jpg)
- [正式九步通關](official-contact.jpg)
- [雨景結果](rain-24.png)
- [手機結果](mobile-final.png)
- [手機跳過動畫](mobile-skip.png)
- [結果期間改變尺寸](mobile-resize.png)
- [下一關零步](next-level.png)

提交後沿原分支觸發Vercel preview，部署SHA／READY／分享網址版本與遠端CI最後狀態另記根目錄HANDOFF.md。
