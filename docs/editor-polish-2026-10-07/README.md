# Editor completion flow polish

> 2026-10-12 清理註記：本報告屬歷史版本。原始逐格圖／錄影及部分舊截圖已按核准清單清理；仍存在的拼圖／代表圖保留。下文的原檔名稱與 JSON 路徑僅為當時量測記錄，不能當成目前可開啟的檔案或重播輸入。

- Validation results remain in the shared status location, with a mint border/check for success and amber border/exclamation for invalid or unsolvable boards. Text continues to announce through the existing polite live region. Ordinary editing messages keep their subdued appearance.
- Return to game is an independent top-right action, away from name entry and undo. Narrow mobile widths reserve its space rather than overlapping the title.
- The completion group always orders Verify → Trial → Save/Update. Save is the filled gold endpoint; the other two actions use contrasting outlined treatments.
- Trial gameplay and trial victory both use Return to editor. The victory action resumes the existing editor state instead of opening level selection. Official victories retain the normal next-level/level-selection actions.
- Authored level cards consistently use a dark background, light title and muted light details, including the currently edited state. Action icons have explicit contrasting colors.

## Checks

`npm test` passes. Production build succeeds and replays all 40 official solutions. `scripts/verify-editor-polish.mjs` exercises native mouse/touch input, validates incomplete and solvable boards, saves then updates, wins a trial through a real car drag, returns to the editor and checks its preserved draft, then opens the custom-level list.

Screenshots cover desktop, 390px and 320px mobile emulation. Hit tests verify the return button and all 36 cells remain unobscured, and that the desktop fleet list can be clicked. The current custom-card title contrast is approximately 11.02:1 and details contrast 7.34:1. Browser runtime exceptions: none. These mobile checks use Chromium emulation; they do not constitute a physical Safari/iPhone test.
