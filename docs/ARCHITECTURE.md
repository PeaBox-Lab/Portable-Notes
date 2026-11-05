# Portable Notes Architecture

Portable Notes uses a local Python HTTP server and a dependency-free HTML/CSS/JavaScript client. Markdown in the configured vault is authoritative. `data/index.db` is a disposable SQLite search index and can be deleted and rebuilt.

## Package boundaries
- `app.py`: compatibility HTTP host and existing route surface
- `core/tasks.py`: canonical immutable task model and Markdown task parser
- `core/errors.py`: typed application errors
- `services/task_repository.py`: reusable task query/filter boundary
- `api/`: route-module boundary for incremental extraction from the compatibility host

## Task parsing
All task syntax definitions are centralized in `core/tasks.py`: completion, due date, baseline, project, priority, estimate, task ID, dependencies, and milestone. Existing route handlers import the shared compiled regular expressions, preventing syntax drift while preserving route compatibility.

## Data model
Markdown is the source of truth. SQLite and all analytics are reconstructable projections. No planning endpoint creates a competing database.

## Security
The server binds to `127.0.0.1`. Relative paths reject dot paths, traversal and encoded traversal. Note names strip control and filesystem-reserved characters and are length-limited.
