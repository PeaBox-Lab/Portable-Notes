# Changelog

## [2.27.0] - 2026-11-05
### Added
- Baseline Health API and command
- Baseline coverage and tracked/untracked metrics
- Project Green/Amber/Red health classification

### Retained
- All v2.26 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Baseline task dates
- Schedule Slippage API and command
- Per-task slip days and project-level slippage rollups

### Retained
- All v2.25 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Daily Schedule Plan API and command
- Configurable daily capacity
- Capacity-constrained effort splitting
- Due-date/priority ordering and plan finish date

### Retained
- All v2.24 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Capacity-based delivery forecast API and command
- Remaining-effort and weeks-needed calculation
- Forecast finish date and schedule-risk classification

### Retained
- All v2.23 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Burndown planning API and command
- Configurable 1-90 day horizon
- Ideal and scheduled remaining-effort trajectories

### Retained
- All v2.22 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Seven-day capacity planning
- Configurable weekly capacity
- Utilization, remaining hours, and load status
- Capacity API and command

### Retained
- All v2.21 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Task effort estimates
- Workload API and command
- Project effort, urgency, unestimated-work and load-score metrics

### Retained
- All v2.20 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Task Risk Radar API and command
- Deterministic risk score and severity classification
- Risk reasons covering due dates, priorities, and dependencies

### Retained
- All v2.19 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Critical-path API and command
- Dependency-depth analysis
- Critical-chain candidate and cycle detection

### Retained
- All v2.18 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Markdown task IDs and dependencies
- Dependency API and command
- Ready, Blocked, and Unresolved classifications
- Missing dependency diagnostics

### Retained
- All v2.17 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Milestone Board API and command
- Overdue, Active and Done milestone lanes
- Project/milestone filtering
- Per-milestone progress summaries

### Retained
- All v2.16 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Markdown milestone metadata
- Milestone API and command
- Milestone progress, overdue, completion, and next-due metrics

### Retained
- All v2.15 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Project Timeline API and command
- Chronological dated-task views
- Project filtering and monthly rollups

### Retained
- All v2.14 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Project Workspace API and command
- Focused project metrics and task list
- Source-note counts
- Risk-aware project task ordering

### Retained
- All v2.13 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Project Health API and command
- Per-project completion and workload metrics
- Overdue/high-priority project risk indicators
- Next-due-date tracking

### Retained
- All v2.12 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Productivity statistics API and command
- Completion percentage
- Overdue and due-today metrics
- Priority distribution and per-project completion rollups

### Retained
- All v2.11 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Weekly review API and command
- Review summary metrics
- Project workload rollup
- Overdue, next-seven-day, and undated review groups

### Retained
- All v2.10 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Configurable task Focus API
- Overdue/today/upcoming/priority focus buckets
- Priority-aware focus sorting
- 7-day Focus command

### Retained
- All v2.9 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Kanban-style task board API
- Overdue, Today, Upcoming, No Due Date, and Done lanes
- Project board filtering
- Priority-aware lane ordering
- Task Board command

### Retained
- All v2.8 and earlier functionality.


## [2.27.0] - 2026-11-05
### Added
- Dated task calendar API
- Date-range agenda filtering
- Task calendar command
- Calendar entries retain project, priority, note, path, and line context

### Retained
- All v2.7 and earlier functionality.


## [2.27.0] - 2026-11-05
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
