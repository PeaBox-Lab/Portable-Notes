
# Portable Notes

[![Release](https://img.shields.io/github/v/release/iwebslogtech/Portable-Notes)](https://github.com/iwebslogtech/Portable-Notes/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/)
[![Local First](https://img.shields.io/badge/storage-local--first-6b5cf5.svg)](#privacy-and-data)

A private, local-first Markdown notes and personal knowledge-management application inspired by Obsidian, OneNote, Notepad++, and VS Code.

**Repository:** https://github.com/iwebslogtech/Portable-Notes

## What's new in 2.9.0

- Persistent multi-note tabs and a smoother writing workflow
- Find and replace with `Ctrl+F`
- Automatic note-history snapshots with restore
- Markdown files remain the source of truth
- Select a custom vault with `python app.py --vault PATH`
- Nested folders and file-tree navigation
- YAML front matter for stable metadata
- Disposable SQLite search and backlink index
- External file-change detection
- Rename-safe wiki-link updates
- Daily notes, templates, command palette, favorites, and pinning
- Portable Markdown ZIP export
- Internal recoverable trash
- Updated GitHub community and release metadata

## Run

```bash
git clone https://github.com/iwebslogtech/Portable-Notes.git
cd Portable-Notes
python app.py
```

Open `http://127.0.0.1:8765`, or simply double-click `start.bat` on Windows.

### Custom vault

```bash
python app.py --vault "D:\Notes\My Vault"
```

## Privacy and data

Your notes are ordinary `.md` files under `vault/` by default. The generated `data/index.db` is only a replaceable search index. Portable Notes binds to `127.0.0.1`, includes no telemetry, and requires no account.

Back up the `vault/` directory or use the Export button. You can open the same notes with Obsidian, Notepad++, VS Code, or any Markdown editor.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New note |
| `Ctrl+S` | Save |
| `Ctrl+K` | Search |
| `Ctrl+Shift+P` | Command palette |

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Migration guide](docs/MIGRATION.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

## License

MIT, see [LICENSE](LICENSE).

## 2.4 search and knowledge

Portable Notes 2.4 adds FTS5-backed search, saved searches, unlinked mentions, and duplicate detection while retaining the existing Markdown-first writing, history, attachment, export, and recovery workflow.

## 2.5 tasks and projects
Markdown checkboxes are aggregated across the vault. Add `due: YYYY-MM-DD` or `📅 YYYY-MM-DD` to a task to expose its due date. Use the command palette for Global open tasks.

## 2.6 task intelligence
Enhance Markdown tasks with `priority: high`, `!high`, `project: Alpha`, or `#project/Alpha`. Portable Notes marks incomplete past-due tasks as overdue and exposes Overdue tasks and High-priority tasks in the command palette.

## 2.7 project dashboard
Use **Task & project dashboard** from the command palette for vault-wide totals and per-project open, completed, overdue, and high-priority counts. Metrics are derived from Markdown tasks without creating a competing task database.

## 2.8 task calendar
Dated Markdown tasks now form a chronological agenda. Use **Task calendar** from the command palette, or query `/api/task-calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`. Existing `due:` and `📅` syntax remains the source of truth.

## 2.9 task board
Use **Task board** from the command palette to group Markdown tasks into Overdue, Today, Upcoming, No Due Date, and Done lanes. The `/api/task-board?project=Name` endpoint can focus the board on one project.
