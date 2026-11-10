# Portable Notes 3.0.0 — "Nebula"

The next generation of Portable Notes. Same zero-dependency local-first architecture (Python stdlib + vanilla JS), rebuilt on a modern multi-view workspace inspired by Obsidian, Notion, OneNote, Evernote and Keep.

## Highlights

### New views (all in the activity rail)
- **Task board** — every `- [ ]` in the vault grouped Overdue / Today / Next 7 days / No date / Done; project filter; click a card to open its note.
- **Knowledge graph** — interactive force-directed canvas of your `[[wiki links]]`; drag nodes, scroll to zoom, folder-colored legend, click to open a note.
- **Tags** — a weighted tag cloud with per-tag note listing.
- **Trash** — restore notes back to Inbox or permanently empty.

### New workflows
- **Quick capture** — always-ready Inbox input (`Ctrl+Shift+N`).
- **Slash block commands** — type `/` in the editor for headings, tasks, lists, quotes, code fences, tables, dates, wiki links and dividers.
- **Templates gallery** — instant notes from anything in `Templates/` with `{{title}}`/`{{date}}` substitution.
- **Import** — drop `.md`/`.txt` files anywhere onto the app.
- **Related notes** — Evernote-style suggestions based on shared tags.
- **Focus mode** — `Ctrl+\` hides every panel for distraction-free writing.
- **Print stylesheet** — File → Print produces a clean note page.

### New endpoints
`GET /api/graph` · `GET /api/templates` · `GET /api/trash` · `POST /api/trash/restore` · `POST /api/trash/empty`

### Fixes in this release
- **Critical:** `static/app.js` had been reduced to a broken stub — notes could not be opened, edited, saved or deleted. Full application logic restored and rebuilt for 3.0, with the 2.x test-pinned wiring kept intact.
- `data/config.json` pointed at a stale e2e temp vault — repointed at the real vault; your notes are back.
- Orphan-attachment scan false positives — references are now URL-decoded and matched by relative path or basename, including plain markdown links.
- Graph rendering crash (unqualified variable) — fixed and verified in-browser.

## Compatibility
- 100% Markdown + YAML front matter, same vault layout, fully backward compatible with 2.x vaults.
- All 2.x features retained (history + snapshot diff, find/replace, tabs, favorites/pins, daily notes, task intelligence reports, saved searches, export).

## Testing
- 24/24 unit tests pass; 68/68 live UI/action E2E checks pass. See `UI_TEST_REPORT_v3.0.0.md`.
