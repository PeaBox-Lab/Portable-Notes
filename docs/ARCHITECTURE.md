# Architecture

Portable Notes 2.1 uses a local Python HTTP server and a dependency-free HTML/CSS/JavaScript client. Markdown in the configured vault is authoritative. `data/index.db` caches searchable note content, metadata, wiki links, and file modification times. The index can be deleted and rebuilt without information loss.

## Components

- `app.py`: HTTP API, Markdown vault operations, YAML-compatible front matter, indexing, migration-safe saves, backlinks, and export
- `static/`: browser user interface
- `vault/`: user-owned Markdown and attachments
- `data/config.json`: local vault selection
- `data/index.db`: disposable SQLite index

The server binds only to `127.0.0.1`. It is not designed for deployment on a public network.
