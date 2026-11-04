# Changelog

## [2.11.0] - 2026-11-05
### Added
- Weekly review API and command
- Review summary metrics
- Project workload rollup
- Overdue, next-seven-day, and undated review groups

### Retained
- All v2.10 and earlier functionality.


## [2.11.0] - 2026-11-05
### Added
- Configurable task Focus API
- Overdue/today/upcoming/priority focus buckets
- Priority-aware focus sorting
- 7-day Focus command

### Retained
- All v2.9 and earlier functionality.


## [2.11.0] - 2026-11-05
### Added
- Kanban-style task board API
- Overdue, Today, Upcoming, No Due Date, and Done lanes
- Project board filtering
- Priority-aware lane ordering
- Task Board command

### Retained
- All v2.8 and earlier functionality.


## [2.11.0] - 2026-11-05
### Added
- Dated task calendar API
- Date-range agenda filtering
- Task calendar command
- Calendar entries retain project, priority, note, path, and line context

### Retained
- All v2.7 and earlier functionality.


## [2.11.0] - 2026-11-05
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
