# Trial win → editor draft verification

Game version: `b0f098f0`. Desktop in-app browser, 1280 × 720.
Isolated origin: `http://127.0.0.8:4173/`; user localhost data was not changed.

1. Created an unsaved draft named 試玩返回檢查 with a horizontal two-cell target at row 3, column 1, and a vertical two-cell compact at row 2, column 4 (one-based coordinates).
2. Validation returned solvable, best 2 moves. Entered trial without saving.
3. Dragged the blocker down two cells, then the red car right four cells; completed in two moves.
4. Confirmed the result panel offers 再玩一次 / 返回編輯器. Selected 返回編輯器 within the result dialog and waited for the editor to initialize.
5. Compared draft title and all car-list accessible labels before/after: exact match, including vehicle models, positions, orientations and lengths. Trial moves did not replace the draft layout.
6. Undo removed the second car (one remaining); redo restored it (two remaining).
7. Returned to official level 01 with zero moves. Level browser still reported 0 / 40 completed and level 01 had no stars. No console errors captured.

Screenshots: [draft](01-draft.png), [trial win](02-trial-win.png), [returned draft](03-returned-draft.png).

No game source changes, rebuild or deployment in this verification. This is a desktop interaction check; no new physical-phone test or saved-custom-level update test was performed.
