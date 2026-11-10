
# Portable Notes

[![Release](https://img.shields.io/github/v/release/PeaBox-Lab/Portable-Notes)](https://github.com/PeaBox-Lab/Portable-Notes/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/)
[![Local First](https://img.shields.io/badge/storage-local--first-6b5cf5.svg)](#privacy-and-data)

A private, local-first Markdown notes and personal knowledge-management application inspired by Obsidian, OneNote, Notepad++, and VS Code.

**Repository:** https://github.com/PeaBox-Lab/Portable-Notes

## What's new in 3.1.0 — Constellation

A reliability and polish release on top of 3.0.0 ("Nebula"). Your vault carries over unchanged.

- **Board task toggling** — every card has a round checkbox; click to mark done/not done. The card moves lanes, the Markdown file is rewritten, and a history snapshot is taken first (undo from Note history). New `POST /api/task/toggle` endpoint.
- **Task-toggle server hang fixed** — the endpoint read the request body twice; the handler no longer blocks.
- **Front matter integrity** — `favorite`/`pinned` no longer flip to true on any rewrite; `updated` is bumped correctly on toggle.
- **No more save-on-open churn** — opening/switching notes no longer rewrites notes that haven't changed (their `updated` timestamps stay honest).
- **Debounced network lookups** — backlinks/related notes refresh 250 ms after you stop typing instead of on every keystroke; knowledge graph repaints only while dragging.
- **Repo hygiene** — `.gitignore` added; `__pycache__` and the disposable `data/index.db` untracked from git.
- **E2E suite self-preserving** — `tests/e2e_ui_actions.py` now restores your real `data/config.json` after the run instead of leaving the app pointed at a temp vault.
- Version 3.1.0 across backend, config, UI, package metadata, launcher and tests; 69/69 E2E checks pass.

### Testing

- 24/24 unit tests pass; 69/69 live UI/action E2E checks pass (see `UI_TEST_REPORT_v3.1.0.md`)

## What's new in 3.0.0 — Nebula

A full next-generation rebuild inspired by Obsidian, Notion, OneNote, Evernote and Google Keep. Same zero-dependency, local-first architecture (Python stdlib + vanilla JS), rebuilt UI, and a new view system:

- **Multi-view workspace** with a new activity rail: **Notes → Board → Graph → Tags → Trash** (`Ctrl+Shift+1–5`)
- **Task board view** — every checkbox task in the vault, grouped Overdue / Today / Next 7 days / No date / Done, filterable by project; click a card to jump to the note
- **Interactive knowledge graph** — deterministic force-directed canvas rendering of `[[wiki links]]`; drag nodes, scroll to zoom, hover for details, click to open a note; folder-colored with a live legend
- **Tag cloud** — every tag with usage counts; select a tag to list its notes
- **Trash view** — browse, restore (back to Inbox) or permanently empty deleted notes
- **Quick capture** — always-ready inbox input in the sidebar (`Ctrl+Shift+N`), saves as a timestamped Inbox note
- **Slash block commands** — type `/` in the editor for headings, tasks, lists, quote, code fence, table, date, wiki link, divider (keyboard or mouse)
- **Templates gallery** — new note from anything in `Templates/` with `{{title}}` / `{{date}}` substitution
- **Import Markdown** — drag & drop `.md`/`.txt` files anywhere onto the app, or via the command palette
- **Related notes** — Evernote-style suggestions in the Knowledge panel based on shared tags
- **Focus mode** — `Ctrl+\` hides all panels for distraction-free writing
- **Design system 3.0** — new nebula token palette (light/dark), refreshed rail, print stylesheet
- **New backend endpoints** — `/api/graph`, `/api/templates`, `/api/trash`, `/api/trash/restore`, `/api/trash/empty`
- **Orphan-attachment scan fixed** — references are URL-decoded and matched by relative path or basename in both regular `[links]()` and `![[embeds]]`
- Full 2.32.0 feature parity retained: note history & diff, find/replace, tabs, task intelligence reports, palette, favorites/pins, daily notes, export

### Testing

- 24/24 unit tests pass; 68/68 live UI/action E2E checks pass (see `UI_TEST_REPORT_v3.0.0.md`)

## What's new in 2.32.0

- Corporate UI rebuild: token-driven design system (slate + corporate blue), refined rail, cards, tabs, dialogs, and dark theme with depth
- Every blocking `alert()`/`prompt()`/`confirm()` dialog replaced with proper in-app dialogs:
  - Find & replace dialog with locate / replace once / replace all and match feedback
  - Note history dialog with one-click snapshot restore
  - Report dialogs with copy-to-clipboard for all 25 task and project intelligence commands
  - Promise-based input/confirm dialogs (`ask`)
- Editor toolbar (bold, italic, headings, lists, tasks, quote, code, table, rule, date, wiki link) plus `Ctrl+B` / `Ctrl+I` and Tab-to-indent
- Clickable task checkboxes in the rendered preview toggle the Markdown source
- Outline headings jump into the editor caret or the matching preview heading
- Collapsible folder tree, note-list sorting (updated / A→Z / Z→A), saved-search shortcut button
- Attachments: upload from the UI and insert vault-relative links
- Row-level note metadata: relative timestamps, tag chips, pin/favorite markers
- Command palette grouped by section with arrow-key navigation and Enter to run
- View-mode cycle fixed (Edit → Split → Preview) with correct editor/preview visibility
- Renaming a note no longer leaves dead persistent tabs
- Word / character / reading-time status row
- Theme cycle light → dark → auto (follows OS preference)

### Testing

- 2.31.0 UI/action E2E suite regenerated: **report below, all checks green.**

<details>
<summary>What's new in 2.30.4</summary>

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

</details>

## Run

```bash
git clone https://github.com/PeaBox-Lab/Portable-Notes.git
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

## 2.10 focus view
Use **7-day focus** from the command palette for overdue, today, near-term, and important undated work. The API accepts `/api/task-focus?days=N` with a bounded horizon up to 365 days.

## 2.11 weekly review
Run **Weekly review** from the command palette for a planning snapshot covering open/completed work, overdue tasks, the next seven days, undated work, and open-task counts by project.

## 2.12 productivity stats
Use **Productivity stats** from the command palette for completion percentage, open/done counts, overdue and due-today metrics, open work by priority, and per-project completion rollups. Statistics are derived from Markdown tasks.

## 2.13 project health
Use **Project health** from the command palette to compare project completion, open work, overdue items, high-priority work, and next due dates. Projects with greater task risk appear first.

## 2.14 project workspace
Use **Project workspace** from the command palette, enter a project name, and get focused metrics plus its ordered tasks and source-note count. The workspace is derived directly from Markdown project metadata.

## 2.15 project timeline
Use **Project timeline** to see dated work chronologically across the vault or for one project, plus monthly open/completed rollups.

## 2.16 milestones
Add `milestone: Release1` or `#milestone/Release1` to Markdown tasks. Use **Milestones** to review progress, overdue work, completion percentage, and next due date across milestones or within one project.

## 2.17 milestone board
Use **Milestone board** to operationalize milestone-tagged Markdown tasks in Overdue, Active, and Done lanes, optionally filtered to one project or milestone.

## 2.18 task dependencies
Assign `taskid: Build` (or `#task/Build`) and link another task with `depends: Build` (or `#depends/Build`). **Task dependencies** identifies ready work, blocked tasks, and unresolved references.

## 2.19 critical path
Use **Critical path** to analyze task-ID dependency chains, identify the deepest chain candidates, and surface dependency cycles.

## 2.20 risk radar
Use **Risk radar** to prioritize open work by deterministic risk score. Overdue, high-priority, dependency-blocked, and unresolved-dependency tasks receive progressively higher scores.

## 2.21 workload planning
Add `estimate: 2h` or `est: 2h` to open Markdown tasks. Use **Workload** to compare estimated hours, overdue work, next-seven-day demand, unestimated work, and a deterministic load score by project.

## 2.22 capacity planning
Use **Capacity** to compare the next seven days of estimated Markdown work with a configurable weekly capacity. Projects are classified Available below 80%, Tight from 80%-100%, and Overloaded above 100%.

## 2.23 burndown planning
Use **Burndown** to compare an ideal effort trajectory with scheduled remaining Markdown work across a configurable 1-90 day horizon. Unestimated open tasks count as 1 hour so they remain visible.

## 2.24 delivery forecast
Use **Delivery forecast** to estimate project duration from remaining Markdown effort and weekly capacity. Portable Notes compares the capacity-derived finish date with the latest task due date and flags projects as On Track or At Risk. Unestimated tasks use the existing 1-hour visibility default.

## 2.25 schedule plan
Use **Schedule plan** to turn open tasks into a daily execution sequence using configurable daily capacity. Tasks are ordered by due date and priority and large estimates can be split across days.

## 2.26 schedule slippage
Add `baseline: YYYY-MM-DD` (or `base:`) alongside a task due date. **Schedule slippage** compares baseline versus current due date and reports slipped, ahead, or on-baseline work with project-level averages and maximum slip.

## 2.27 baseline health
Use **Baseline health** to measure how completely project tasks are baselined and whether the schedule is moving. Green means no overdue work and no positive average slip; Amber indicates untracked tasks or positive average slip up to three days; Red indicates overdue work or average slip above three days.

## 2.28 metadata quality
Use **Metadata quality** to audit task IDs, due dates, baselines, estimates, duplicate IDs, and dependency references. Each task receives a deterministic 0-100 quality score, with project-level quality rollups.

## 2.29 execution readiness
Use **Execution readiness** to combine metadata quality, dependencies, overdue state, and duplicate-ID checks into an actionable readiness score. Open tasks are classified Ready, Attention, or Blocked, with explicit blocker explanations.

## 2.30 architecture and reliability
The v2.30 stabilization release centralizes task syntax in `core/tasks.py`, adds domain/service/API package boundaries, expands automated coverage, restores missing historical release documentation, and retains the existing v2.29 routes and cumulative features.

## 2.30.4 UI reliability
This hotfix prevents stale UI assets, adds visible command errors, and includes a reproducible 60-check live-server end-to-end suite. Run `python tests/e2e_ui_actions.py` from the application folder to repeat it.
