# 頭燈配光研究與修正

2026-10-11；feature/game-feel；最終版本 `04ac9056`。

使用者要求先廣泛搜尋實車照片，著重扇形、雙燈重疊與車前照地距離，再調整遊戲。原街景、關卡、精緻車輛、動物與出庫動作保留。

## 實際查閱的參考

搜尋了照牆配光、路面照射、低／高光比較及霧中雙燈。主要技術依據為製造商與實測機構；商品頁只觀察照片，不採信亮度或合規宣傳。

- [HELLA 技術說明與三種近光實測](https://www.hella.com/techworld/en/technical/automotive-lighting/light-distribution/)：實際檢視鹵素、氙氣、LED 照牆照片。三者均橫向展開、上方受控截止，右側路緣配光略抬高；高光圓形／橢圓熱點不能直接當作市區近光。
- [鹵素實測圖](https://media.hella.com/is/182544/191789785648112ca5cc64945eb233eef/c3/-/822e9f4380b8428b89466880a1535cb0?quality=90&strip=yes&format=webp&x=1024)
- [氙氣實測圖](https://media.hella.com/is/182544/191789785648112ca5cc64945eb233eef/c3/-/0598256732df410da6dd4ffdfc145211?quality=90&strip=yes&format=jpg&x=1024)
- [LED 實測圖](https://media.hella.com/is/182544/191789785648112ca5cc64945eb233eef/c3/-/e74f62e760fe4135bd6ee608e7849180?quality=90&strip=yes&format=webp&x=1024)
- [IIHS 頭燈測試](https://www.iihs.org/ratings/about-our-tests/headlights)、[支持研究 PDF](https://www.iihs.org/media/9b0f599a-7a50-4bc4-b8d2-1cf6b52a128a/VSGFZg/Ratings/Protocols/current/headlight_rationale_supporting_work.pdf)：實車光型、安裝高度、瞄準角度均影響道路亮度，左右燈輸出相加，不能指定所有車共用的唯一亮斑距離。
- [道路近／遠光與照牆比較照片](https://www.naoevolighting.com/cdn/shop/products/10_28bda77a-c62e-4896-ad2c-e95a4a696738.jpg?v=1679035356)：觀察連續路面照明與上方明暗差異，沒有使用其 lux 數字校準遊戲。
- [霧中雙燈實拍](https://npr.brightspotcdn.com/legacy/sites/wamc/files/201701/headlights-1449254_960_720.jpg)：兩個獨立光源前方自然展開並重疊，霧的散射很強；只作氣氛參考，沒有把濃霧效果搬到晴朗夜景。
- [The Retrofit Source 配光介紹](https://blog.theretrofitsource.com/what-makes-a-good-beam-pattern/)：讀取配光、瞄準說明；本次網頁的比較表未實際載入內嵌照片，因此不把缺圖表格算作已看過的照片。

## 實作與距離

新增共用 128×128 線性強度配光貼圖，交給兩顆原有、有遮擋陰影的 SpotLight 實際照亮地面／車身；不是畫在地上的假光斑。光源仍依模型燈罩取點，並行朝車頭前方，不向內交叉。近光有較寬的橫向分布、柔和上方截止與少量右側抬升，低角度前景光接到主要亮區。略增加下俯角，減少車前暗空隙；沒有把主亮區硬貼保險桿。空氣散射套用相同配光與遮擋，晴夜大幅變淡，雨景略多；關閉陰影時不取用舊深度圖。

真實車燈的主要亮區可在前方較遠處，保險桿正下方不必強亮；近處到主要亮區仍有較淡的漸層。本場景為微縮模型，距離、亮度採視覺調整，沒有真實公尺／lux 校準，不宣稱複製特定車款 IES 或法規認證。

保持兩顆頭燈、兩顆尾燈、兩張 256×256 深度圖、拖車陰影更新預算與出庫逐幀同步。日行燈、煞車／倒車燈、停車熄燈、雨材質、排氣不變。無額外燈光、外部貼圖下載或依賴。

## 驗證

- `npm test` 17 組全通過。新增配光上方截止／橫向寬度、右側抬升、近處銜接、保險桿下不假亮、雙源近處分離／前方相加無暗縫、平行燈軸與共用資源回歸。
- `npm run build` 成功，40 關解答自動重播通過。source／dist／UI `04ac9056` 一致；只有既有大 bundle 提醒。
- 最終版實際拖車九步通關：[連續 20 張出庫](exit-grid.jpg)、[通關](win.png)、[下一關零步](next.png)。光型跟隨車頭轉向，出庫及小動物正常。
- 最終版未儲存單車草稿試玩：[俯視配光](final-open-top.png)、[斜視配光](final-open-angle.png)、[四主題／低角度反向／關陰影／省電／手機彙整](checks-grid.jpg)。手機為瀏覽器 390×844 模擬，不是真機。省電無裝飾光束；關陰影仍保留光型；雨景濕地正常。
- [修改前](before-top.png)為 a359323e，[after-top.png](after-top.png)為早期候選 57856e23；candidate-top.png 是更早候選 97b0c391，candidate-sunset.png 是 33aeee24。它們不是最終驗收圖片。所有 final-*、exit-* 已以最終版重拍。
- localhost 捕捉 console error／warn 空；暫時 viewport 已復原。沿用 `.23` 隔離合成 20 關主題解鎖；未改一般 origin 的進度。未儲存測試草稿，已返回正式關卡。

部署結果待推送後補記。沿用原分支，不合併 main、不重寫歷史；使用者 README、HANDOFF、附件與其他未追蹤報告保留。
