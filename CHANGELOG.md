# Changelog

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
