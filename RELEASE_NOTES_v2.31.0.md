# Portable Notes 2.31.0: Corporate UI Rebuild

## Highlights

**Design system.** The interface was rebuilt on a token-driven stylesheet: a slate-neutral palette with a corporate blue accent, a 58px dark anchoring rail, refined note cards, pill tabs, dialog panels with blurred backdrops, focus-visible rings, status-colored save indicator, and a dark theme with true depth. The previous lavender (#6b5cf5) scheme was replaced with `--accent: #2563eb` and status colors for success/warning/error states.

**No more blocking dialogs.** Every `alert()`, `prompt()` and `confirm()` used by the 38-command palette has been replaced by in-app dialogs:

- *Find & replace* (`Ctrl+F`): locate next (with wrap-around), replace once, replace all, with match feedback.
- *Note history* (`Ctrl+H`): scrollable snapshot list; click to restore, with unsaved-change protection.
- *Report* dialogs: all 25 task/project intelligence commands now render their monospace output in a scrollable, copy-to-clipboard dialog instead of cramming it into `alert()`.
- *Ask* dialogs: all prompts (new folder, project name, capacity hours, saved-search name, destructive trash confirm) are promise-based focused dialogs.

## New capabilities

- Editor toolbar: bold, italic, H1/H2, bullet, task, quote, code, table, rule, today's date, wiki link, attach file. Keyboard: `Ctrl+B`, `Ctrl+I`, Tab-to-indent; `Ctrl+D` daily note; `Ctrl+H` history.
- Clicking a checkbox in the *rendered preview* toggles the matching `- [ ]`/`- [x]` in the Markdown source.
- Outline items jump straight to the caret line in the editor, or to the heading anchor while reading in preview.
- Attach any file (≤25 MB) from the UI; a vault-relative link is inserted into the note.
- Collapsible folder tree; note list sort by updated / A→Z / Z→A; relative timestamps, tag chips and pin/favorite markers on cards.
- Command palette grouped by section (Notes, Writing, Vault, Tasks & projects) with arrow-key navigation and Enter to run.
- Theme cycles light → dark → auto (auto follows the operating-system preference).
- New commands: *Duplicate current note*, *Copy note markdown*.

## Fixes

- The view-mode cycle now behaves as labeled: Edit → Split → Preview, with the editor correctly hidden in preview (previously "Preview" still showed the raw editor and labels contradicted the resulting view).
- Renaming a note remaps its persistent tab instead of leaving a dead tab that failed to open.
- Deleting the active note now clears its tab from persistence.

## Compatibility

- No API changes; Markdown stays the source of truth; index remains disposable.
- Regression tokens verified by the test suite (pane scrolling, element wiring) are preserved.
- E2E suite re-run after the rebuild: see `UI_TEST_REPORT_v2.31.0.md`.
