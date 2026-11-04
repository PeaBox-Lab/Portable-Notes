
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
