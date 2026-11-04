# Portable Notes 2.4.0: Search and Knowledge

2.4.0 extends the local-first Markdown vault with knowledge-discovery tools while keeping the application dependency-free.

## New
- FTS5-powered `/api/search` with graceful LIKE fallback when FTS5 is unavailable
- Query filtering support for folders and tags at the API layer
- Saved searches stored locally in the browser
- Unlinked mention discovery for the current note
- Exact normalized-content duplicate detection
- Command-palette actions for saved searches, unlinked mentions, and duplicates

## Retained
All existing Markdown vault, folders, links/backlinks, tags, favorites, pinning, daily notes, templates, autosave, tabs, history, find/replace, attachments API, export, trash, custom-vault and privacy capabilities remain.
