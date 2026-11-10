# Portable Notes 3.1.0 — "Constellation"

A focused fix-and-polish release after 3.0.0 ("Nebula"). Same architecture, same vault format — your notes carry over untouched.

## What's new

### Board: toggle tasks in place
Every task card on the **Board** view now has a round checkbox. Click it to mark the task done (or not done) without leaving the board — the card moves between lanes, the note on disk is rewritten, and a history snapshot is taken first so you can undo from **Note history**. The open editor stays in sync.

Endpoint: `POST /api/task/toggle` `{ "path": "...", "line": n }` where `line` is the 1-based line in the note body (same numbering the board shows).

### Repo hygiene
- `.gitignore` added: `__pycache__/`, `*.py[cod]`, `data/index.db` (the disposable SQLite index), caches and editor folders.
- Cached bytecode and the local `index.db` are no longer tracked in git.
- The e2e test suite now backs up and restores your real `data/config.json` instead of redirecting the app to a temp vault and forgetting about it.

## Fixes in this release
- **Server hang on `/api/task/toggle`** (introduced in this cycle): the handler called `read_body()` a second time after the request body had already been consumed — the server blocked forever. Removed.
- **Toggle targeted the wrong lines**: board line numbers refer to the frontmatter-stripped note body; the toggle now rewrites body lines and rebuilds the front matter instead of the raw file.
- **`front()` flipped your favorites/pins**: the string `'false'` parsed as truthy and any frontmatter rewrite silently set `favorite: true` / `pinned: true`. Now uses `boolv()`.
- **Opening a note rewrote it**: switching notes always saved the current one, bumping `updated:` even when nothing changed. Saves now happen only when the editor is actually dirty.
- **Keystroke network storm**: backlinks + related-notes lookups fired on every keystroke; they are now debounced (250 ms).
- **Graph repainted constantly**: the canvas repainted on every window mouse move; it now repaints only while dragging or when the hovered node changes.

## Compatibility
- 100% Markdown + YAML front matter, identical vault layout. 2.x vaults open as-is.
- All 3.0 views retained: Notes / Board / Graph / Tags / Trash.

## Testing
- 24/24 unit tests pass; 69/69 live UI/action E2E checks pass. See `UI_TEST_REPORT_v3.1.0.md`.
