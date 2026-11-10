# Changelog

## [3.0.0] - 2026-11-10 ("Nebula")
### Added
- Multi-view workspace with activity-rail switching: Notes / Board / Graph / Tags / Trash (`Ctrl+Shift+1–5`)
- Task board view: all checkbox tasks grouped Overdue / Today / Next 7 days / No date / Done, project filter, click-to-open
- Interactive knowledge graph (deterministic force-directed canvas, folder-colored, pan/zoom/drag, click node to open note)
- Tag cloud with counts and per-tag note listing
- Trash view with restore-to-Inbox and empty-trash (backend `/api/trash`, `/api/trash/restore`, `/api/trash/empty`)
- Knowledge-graph endpoint `/api/graph`; templates endpoint `/api/templates`
- Quick capture sidebar input (`Ctrl+Shift+N`) — creates timestamped Inbox notes
- Slash block commands in the editor (`/` menu: heading, task, list, quote, code fence, table, date, wiki link, divider)
- Templates gallery (toolbar rail button + palette) with `{{title}}` / `{{date}}` substitution
- Import notes by dropping `.md`/`.markdown`/`.txt` files anywhere onto the window
- Related notes panel (Evernote-style) from shared tags
- Focus mode (`Ctrl+\`) for distraction-free writing; print stylesheet
- New "Nebula" 3.0 design tokens (light/dark), rebuilt rail/sidebar/board/graph/tags/trash styles

### Fixed
- Frontend application logic was missing after a previous edit — full `static/app.js` rebuilt with all 2.x features intact plus the new views
- `data/config.json` pointed at a stale e2e temp vault — repointed at the real vault
- Orphan-attachment scan compared bare filenames to full reference paths — now URL-decodes and matches on relative path or basename, including regular markdown links
- `app.js` graph rendering crashed on an unqualified variable — fixed and verified in browser

### Changed
- Version raised to 3.0.0 across backend, config, UI, package metadata, tests, and launcher
- E2E suite validates `3.0.0` (see `UI_TEST_REPORT_v3.0.0.md`)

### Testing
- 24/24 unit tests pass
- 68/68 live UI/action E2E checks pass

## [2.32.0] - 2026-11-10
### Added
- Version consistency aligned across backend, config, UI, package metadata, and E2E tests
- Startup banner displays version 2.32.0
- E2E test suite validates `2.32.0` in health endpoint and cache-busted assets
- Dedicated release notes `RELEASE_NOTES_v2.32.0.md`
- Audit report `AUDIT_REPORT.md` documenting version consistency verification

### Fixed
- Removed stale `2.31.0` version references from all critical files
- Backend startup banner updated from `2.31.0` to `2.32.0`

### Changed
- All version references raised to 2.32.0 in `app.py`, `core/vault.py`, `api/system.py`, `static/index.html`, `static/style.css`, `static/app.js`, `data/config.json`, `pyproject.toml`, `tests/e2e_ui_actions.py`, `README.md`

### Testing
- 24/24 unit tests pass
- 68/68 live UI/action E2E checks pass
- All Python modules compile cleanly
- Version consistency audit passes across all critical files

## [2.31.0] - 2026-11-09
### Added
- Token-driven corporate design system in `static/style.css` (light/dark/auto theme).
- Editor toolbar with formatting insert helpers; `Ctrl+B` / `Ctrl+I`; Tab indents.
- Clickable checkbox in preview toggles the Markdown source task.
- Outline-to-caret/preview heading jumps.
- Attach-file flow from the UI (uploads to `vault/Attachments`).
- Note-list sorting and collapsible folder tree (state persisted).
- Report + ask + find/replace + history dialogs; palette groups and keyboard navigation.
- `Copy note markdown`, `Duplicate current note` commands.

### Fixed
- View-mode cycle now correctly hides the editor in Preview and matches its button label.
- Renaming a note now remaps persistent tabs instead of leaving dead entries.
- Deleting a note clears its tab reliably.

### Changed
- All blocking `alert`/`prompt`/`confirm` interactions replaced with in-app dialogs.
- Cache-bust and health version raised to 2.31.0; UI E2E expectations updated.

### Testing
- 60+ live UI/action checks re-run (see `UI_TEST_REPORT_v2.31.0.md`).

## [2.30.4] - 2026-11-05
### Fixed
- Independent scrolling for every long UI pane and dialog.
- Preview overflow and compact-height behavior.
- Note and preview scroll positioning.

### Testing
- Re-audited all commands, buttons and API-backed actions.


## [2.30.4] - 2026-11-05
### Fixed
- Editor and preview vertical scrolling.
- Navigation and command-palette scroll regions.
- Flex/grid shrink constraints that trapped long note content.

### Testing
- 63 live UI/action checks passed.
- 24 automated unit/layout checks passed.
- Revalidated all command and button linkages.


## [2.30.4] - 2026-11-05
### Fixed
- Rebuilt Windows launch flow and clarified that `index.html` cannot run standalone.
- Added direct-file and server-connection diagnostics.
- Revalidated every control, command function, and API linkage.


## [2.30.4] - 2026-11-05
### Fixed
- Prevented stale broken JavaScript from being reused through versioned assets and no-cache headers.
- Added visible async error handling for all command-palette actions.
- Rendered command-palette entries as accessible buttons.

### Testing
- Added a 60-check live-server UI/end-to-end suite covering every menu action and primary control.
- Added `UI_TEST_REPORT_v2.30.4.md` with the complete result inventory.

### Retained
- All v2.30.0 architecture, security, APIs and cumulative functionality.


## [2.30.4] - 2026-11-05
### Architecture
- Added canonical immutable Task model and parser.
- Centralized task metadata syntax.
- Added core, services, and API package boundaries.
- Added reusable TaskRepository and typed application errors.

### Front-end blocker fix
- Repaired invalid Markdown/wiki-link JavaScript regular expressions that stopped `app.js` at parse time.
- Added front-end syntax and control-wiring regression coverage.

### Reliability
- Expanded automated tests from 3 to 19.
- Added parser, repository, security, alias, default, dependency, and serialization coverage.
- Restored v2.3.0 release-note continuity.
- Rewrote architecture documentation to be version-neutral.

### Retained
- Existing v2.29 features, routes, Markdown compatibility, and standard-library portability.


## [2.29.0] - 2026-11-05
### Added
- Execution Readiness API and command
- Ready, Attention, and Blocked task states
- Deterministic readiness scoring and blocker explanations
- Project-level readiness rollups

### Retained
- All v2.28 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Metadata Quality API and command
- Task metadata completeness scoring
- Duplicate task-ID and unresolved-dependency diagnostics
- Project-level quality rollups

### Retained
- All v2.27 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Baseline Health API and command
- Baseline coverage and tracked/untracked metrics
- Project Green/Amber/Red health classification

### Retained
- All v2.26 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Baseline task dates
- Schedule Slippage API and command
- Per-task slip days and project-level slippage rollups

### Retained
- All v2.25 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Daily Schedule Plan API and command
- Configurable daily capacity
- Capacity-constrained effort splitting
- Due-date/priority ordering and plan finish date

### Retained
- All v2.24 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Capacity-based delivery forecast API and command
- Remaining-effort and weeks-needed calculation
- Forecast finish date and schedule-risk classification

### Retained
- All v2.23 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Burndown planning API and command
- Configurable 1-90 day horizon
- Ideal and scheduled remaining-effort trajectories

### Retained
- All v2.22 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Seven-day capacity planning
- Configurable weekly capacity
- Utilization, remaining hours, and load status
- Capacity API and command

### Retained
- All v2.21 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Task effort estimates
- Workload API and command
- Project effort, urgency, unestimated-work and load-score metrics

### Retained
- All v2.20 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Task Risk Radar API and command
- Deterministic risk score and severity classification
- Risk reasons covering due dates, priorities, and dependencies

### Retained
- All v2.19 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Critical-path API and command
- Dependency-depth analysis
- Critical-chain candidate and cycle detection

### Retained
- All v2.18 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Markdown task IDs and dependencies
- Dependency API and command
- Ready, Blocked, and Unresolved classifications
- Missing dependency diagnostics

### Retained
- All v2.17 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Milestone Board API and command
- Overdue, Active and Done milestone lanes
- Project/milestone filtering
- Per-milestone progress summaries

### Retained
- All v2.16 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Markdown milestone metadata
- Milestone API and command
- Milestone progress, overdue, completion, and next-due metrics

### Retained
- All v2.15 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Project Timeline API and command
- Chronological dated-task views
- Project filtering and monthly rollups

### Retained
- All v2.14 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Project Workspace API and command
- Focused project metrics and task list
- Source-note counts
- Risk-aware project task ordering

### Retained
- All v2.13 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Project Health API and command
- Per-project completion and workload metrics
- Overdue/high-priority project risk indicators
- Next-due-date tracking

### Retained
- All v2.12 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Productivity statistics API and command
- Completion percentage
- Overdue and due-today metrics
- Priority distribution and per-project completion rollups

### Retained
- All v2.11 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Weekly review API and command
- Review summary metrics
- Project workload rollup
- Overdue, next-seven-day, and undated review groups

### Retained
- All v2.10 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Configurable task Focus API
- Overdue/today/upcoming/priority focus buckets
- Priority-aware focus sorting
- 7-day Focus command

### Retained
- All v2.9 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Kanban-style task board API
- Overdue, Today, Upcoming, No Due Date, and Done lanes
- Project board filtering
- Priority-aware lane ordering
- Task Board command

### Retained
- All v2.8 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Dated task calendar API
- Date-range agenda filtering
- Task calendar command
- Calendar entries retain project, priority, note, path, and line context

### Retained
- All v2.7 and earlier functionality.


## [2.29.0] - 2026-11-05
### Added
- Task and project dashboard API
- Vault-wide completion and overdue statistics
- Per-project workload rollups
- Dashboard command-palette action

### Retained
- All v2.6 and earlier functionality.


## [2.6.0] - 2026-11-05
### Added
- Task priority and project metadata
- Overdue detection
- Priority/project task filtering
- Overdue and high-priority command views
- Deterministic task ordering

### Retained
- All v2.5 and earlier functionality.


## [2.5.0] - 2026-11-05
### Added
- Global Markdown task aggregation
- Open/completed task filters
- Due-date recognition
- Global open-task command

### Retained
- All 2.4 functionality remains available.


## [2.4.0] - 2026-11-05
### Added
- FTS5 search endpoint with fallback search
- Saved searches
- Unlinked mention discovery
- Duplicate-note detection
- Folder/tag search filters at the API layer

### Retained
- Existing local-first Markdown notes, attachments, tabs, note history, wiki links/backlinks, export, trash, daily notes, templates, and privacy model.



## [2.2.0] - 2026-11-05

### Added
- Multi-note tab strip with persistent recent tabs
- Find and replace with `Ctrl+F`
- Automatic local note history snapshots, retaining the latest 20 revisions per note
- History restore command from the command palette

### Retained
- Markdown vault source of truth, nested folders, wiki links/backlinks, tags, favorites, pinning, daily notes, templates, autosave, external-change detection, rename-safe links, SQLite index, recoverable trash, ZIP export, command palette, preview modes, themes, and localhost-only operation from 2.1.0
- Original Markdown-note interoperability and lightweight workflow from the 2.0 lineage

### Security
- Server remains bound to `127.0.0.1` and vault traversal protection remains enabled.

## [2.1.0] - 2026-11-05
- Markdown Vault Foundation.
