# Changelog

## [2.1.0] - 2026-11-05

### Added
- Markdown vault as the authoritative data store
- Nested file tree, custom vault paths, daily notes, templates, and command palette
- YAML-compatible metadata, external-change detection, backlinks, and disposable SQLite index
- Rename-safe wiki-link maintenance, recoverable trash, and complete vault ZIP export
- Architecture, migration, user-guide, release, security, and GitHub community documentation

### Changed
- Product branding and repository links now consistently target `iwebslogtech/Portable-Notes`
- Search index can be rebuilt entirely from Markdown files
- Browser interface refined for desktop and responsive use

### Security
- Server remains restricted to `127.0.0.1`
- Path traversal is rejected for vault operations
