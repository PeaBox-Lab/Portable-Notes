"""API package boundary for route modules.

This package extracts the HTTP route surface out of the compatibility host
(``app.py``) into domain-focused, pure-Python modules:

* ``api/system.py``   — health check, index rebuild, vault export
* ``api/search.py``   — note search, mentions, duplicates, backlinks, history
* ``api/notes.py``    — note CRUD, file tree, folders, attachments
* ``api/tasks.py``    — all task and project intelligence endpoints

Each handler function is a pure function: it takes explicit parameters
(vault path, DB path, query values, body bytes) and returns a
``(status_code, payload)`` tuple. The HTTP transport layer (headers,
status lines, cache control) stays in ``app.py``. This keeps route logic
decoupled from ``BaseHTTPRequestHandler`` and directly unit-testable.

Package boundaries (see docs/ARCHITECTURE.md):

- ``app.py``:      compatibility HTTP host; route dispatch + response writing
- ``api/``:        route modules; business logic, zero framework coupling
- ``core/``:       canonical models (tasks) and typed errors
- ``services/``:   reusable query layers
"""

from __future__ import annotations

# Route tables: path -> handler function.
# Handlers receive (handler_self, parsed_query) and return
# (status_code, payload) where payload is either a JSON-serialisable dict
# or (body_bytes, content_type, filename) for raw responses.

GET_ROUTES: dict[str, callable] = {}
POST_ROUTES: dict[str, callable] = {}
PUT_ROUTES: dict[str, callable] = {}
DELETE_ROUTES: dict[str, callable] = {}

__all__ = [
    "GET_ROUTES",
    "POST_ROUTES",
    "PUT_ROUTES",
    "DELETE_ROUTES",
]
