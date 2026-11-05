# Portable Notes 2.30.4: Scroll and UI Reliability

## Fixed
- The editor and Markdown preview now have explicit bounded vertical scrolling.
- The central work area can shrink correctly inside the fixed-height application grid.
- Navigation note lists, folder tree, right-side context pane, and command palette now have explicit scroll regions.
- Scrollbar gutters are stable and scroll propagation is contained in major panes.

## UI review
- Rechecked all 35 command functions and all 10 visible button handlers.
- Re-ran every API-backed menu workflow against a live isolated vault.
- Retained the direct-file guard, launcher diagnostics, no-cache assets, and visible command errors.

## Tests
- Live UI/action checks: 63/63 passed.
- Automated unit/layout checks: 24/24 passed.
