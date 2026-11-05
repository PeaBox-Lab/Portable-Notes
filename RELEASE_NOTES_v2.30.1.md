# Portable Notes 2.30.3: UI Reliability Hotfix

This patch release fixes the remaining UI reliability problem and validates every menu action against a live local server.

## Root cause fixed
- Added versioned CSS and JavaScript asset URLs to prevent a browser from reusing a stale broken `app.js`.
- Added `Cache-Control: no-store, no-cache` headers for the application shell and static UI assets.
- Retained the corrected Markdown and wiki-link regular expressions.

## Menu reliability
- Command palette entries are now real buttons.
- Every command runs through a common async error boundary.
- Failed actions now show a visible toast and alert instead of failing silently.
- Added a public UI diagnostic manifest at `window.PortableNotesUI`.

## End-to-end validation
- Added `tests/e2e_ui_actions.py`.
- Validated note creation, opening, editing, favorite, pin, search, folders, history, backlinks, attachments, export and delete.
- Validated all task/project/milestone/planning menu endpoints.
- Validated all local button wiring, editor autosave, command search, keyboard shortcuts, saved searches, find/replace and history UI.
- Final result: 60/60 checks passed.
