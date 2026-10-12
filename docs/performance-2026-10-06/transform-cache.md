# Fixed transform and light colour caching

> 2026-10-12 清理註記：本報告屬歷史版本。原始逐格圖／錄影及部分舊截圖已按核准清單清理；仍存在的拼圖／代表圖保留。下文的原檔名稱與 JSON 路徑僅為當時量測記錄，不能當成目前可開啟的檔案或重播輸入。

Fixed scenery and vehicle parts now compose their local transforms once. The
stationary scene root no longer invalidates all descendant world matrices every
frame. Vehicle roots and suspension bodies remain dynamic, and their descendants
still inherit movement. Light sampling refreshes the complete selected vehicle
branch before reading lamp origins. The entry guide's instance colours upload
only when the theme or victory sequence changes.

In the same 1440×950 DPR 1 nine-car high-quality drag fixture, CPU render
submission median changed from 2.5 ms to 2.3 ms (about 8%). GPU median was
26.00 ms before and 27.62 ms after: this does not demonstrate a GPU improvement.
Draw calls stay at 100 and triangles at 206,480. Automated browser frame rate
remains limited to roughly 8–9 FPS; no physical-phone FPS improvement is claimed.
See `cache-before.json` and `cache-after.json` for the final comparable samples.

`npm test` checks static world-matrix reuse and moving/rotated suspension-mounted
lamp anchors. All nine enlarged model views, right-button orbit, drag and undo,
and mobile layout passed the glazing browser verification. The vehicle-effects
browser verification passed day/sunset/neon, forward/reverse/braking, idle fade,
vertical orientation and real emitter origins for every model, with no runtime
or console errors. The latest reports are in the glazing and lamp-placement
verification folders. `cache-offline.json` verifies the final PWA version,
legacy-worker recovery, offline model loading and preservation of level-17 progress.

No mesh detail, window clarity, render resolution, lighting or suspension quality
was reduced. GPU shadow/lighting cost remains a future optimization target.
