
# Architecture

Portable Notes 2.6 uses a local Python HTTP server and a dependency-free HTML/CSS/JavaScript client. Markdown in the configured vault is authoritative. `data/index.db` caches searchable note content, metadata, wiki links, and file modification times. The index can be deleted and rebuilt without information loss.

## Components

- `app.py`: HTTP API, Markdown vault operations, YAML-compatible front matter, indexing, migration-safe saves, backlinks, and export
- `static/`: browser user interface
- `vault/`: user-owned Markdown and attachments
- `data/config.json`: local vault selection
- `data/index.db`: disposable SQLite index

The server binds only to `127.0.0.1`. It is not designed for deployment on a public network.

## 2.4 knowledge services
The disposable SQLite index exposes FTS5-backed search when available. Mention and duplicate analysis operate entirely on local indexed Markdown content. Saved-search definitions remain browser-local.

## 2.6 task intelligence
Task metadata is parsed directly from Markdown checkbox lines and remains file-first. Priority, project, due-date and overdue fields are derived at request time rather than stored as a second source of truth.

## 2.7 project dashboard
The dashboard derives aggregate task/project statistics from indexed Markdown note content at request time. Markdown remains the canonical source of truth.

## 2.8 task calendar
Calendar entries are derived directly from Markdown task due dates. No separate calendar database is introduced, preserving the file-first architecture.

## 2.9 task board
Board lanes are calculated on demand from Markdown task status and due-date metadata. There is no separate board-state database.

## 2.10 focus view
Focus data is calculated at request time from Markdown tasks. It does not persist a competing planning database.

## 2.11 weekly review
Review metrics are derived on demand from Markdown tasks and existing metadata. No separate planning database is introduced.

## 2.12 productivity statistics
Metrics are calculated on demand from Markdown task state and metadata. Analytics remain disposable and reconstructable from the vault.

## 2.13 project health
Project-health metrics are reconstructed from Markdown tasks at request time, preserving the vault as the canonical data source.

## 2.14 project workspace
A project workspace is a request-time projection of Markdown task metadata. It introduces no separate project database and remains fully reconstructable from the vault.

## 2.15 project timeline
Timeline data is derived from Markdown task due-date and project metadata at request time; no parallel planning store is introduced.

## 2.16 milestones
Milestone state is derived from Markdown task metadata at request time, so the vault remains canonical and analytics remain reconstructable.

## 2.17 milestone board
Board lanes and milestone progress are projections of Markdown task metadata and are reconstructed per request.

## 2.18 task dependencies
Dependency state is derived from Markdown task IDs, dependency references, and completion status. No separate workflow database is introduced.

## 2.19 critical path
Dependency depth is computed with memoized graph traversal over Markdown task IDs. Cycle detection prevents recursive dependency loops from hanging analysis.

## 2.20 risk radar
Risk is deterministic and derived at request time from Markdown metadata. No opaque model or parallel risk database is used.

## 2.21 workload planning
Effort and load metrics are calculated on demand from Markdown task metadata. The load score is deterministic: estimated hours + 4 per overdue task + 2 per task due within seven days + 1 per unestimated task.

## 2.22 capacity planning
Capacity metrics are request-time projections from Markdown due dates and effort estimates. Status thresholds are deterministic: Available under 80%, Tight at 80%-100%, Overloaded above 100%.

## 2.23 burndown planning
Burndown points are derived on demand from open Markdown tasks, due dates, and estimates. Unestimated tasks use a documented 1-hour visibility default rather than being silently ignored.

## 2.24 delivery forecast
Forecasts are deterministic request-time projections from open Markdown task estimates and weekly capacity. They do not use statistical prediction and remain fully explainable.

## 2.25 schedule plan
Scheduling is deterministic and transient. Open Markdown tasks are ordered by due date and priority, then packed into daily capacity buckets; no separate schedule store is created.

## 2.26 schedule slippage
Schedule variance is computed from baseline and current due-date metadata in Markdown. Positive days mean slippage, negative days mean ahead of baseline, and zero means unchanged.
