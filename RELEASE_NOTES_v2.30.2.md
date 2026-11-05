# Portable Notes 2.30.4: Full Linkage Rebuild

- Added an explicit Windows launcher: `OPEN_PORTABLE_NOTES.bat`.
- Added `START_HERE.txt` with exact launch instructions.
- Added a direct-file guard: opening `static/index.html` now explains that the Python server must be started instead of showing a dead interface.
- Added a persistent in-app server connection error banner.
- Rechecked all HTML IDs, button handlers, command functions, and API route linkages.
- Retained cache-busted assets, no-cache headers, and visible command errors.
- Live isolated-vault end-to-end suite: 60/60 checks passed.
- Unit suite: 19/19 passed.
