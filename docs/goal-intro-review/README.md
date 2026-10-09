# Goal introduction and faster departure — 2026-10-09

- Departure duration: 6667 ms → 4068 ms. The spatial trajectory, wheel trajectory alignment and progressive steering return remain intact.
- Replaced the four-page tutorial with a 4600 ms SVG demonstration: move the blue obstruction, then slide the red car through the right exit.
- Starts after the 3D scene is ready; pauses its timer and CSS animation when the document is hidden. Supports Escape/skip, focus restoration and reduced motion.
- Uses existing tutorial completion storage; existing players can replay from 選單 → 通關演示.

## Verification

- All 17 test suites passed, including steering, clearance and each wheel's actual trajectory direction. Build solved and replayed all 40 official routes.
- Fresh isolated loopback browser origin showed the introduction automatically. It dismissed automatically; reload did not repeat it. Menu replay and Escape dismissal verified.
- Played level 1 manually in nine moves and observed successful departure followed by the three-star result. Restart worked.
- Desktop 1280×720 and mobile-size 390×844 screenshots checked; no browser console errors. Mobile viewport verification is not physical-device testing.
- Screenshots: desktop.jpg, mobile.jpg, exit.jpg (departure beginning).

Hidden-tab and reduced-motion behavior were reviewed in implementation; no hardware performance claim is made.
