"""Search, discovery, and link endpoints.

All functions are pure and accept explicit parameters for testability.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import sqlite3


def _serialize(row) -> Dict[str, Any]:
    """Serialize a DB row (tuple or sqlite3.Row) into a dict."""
    keys = [
        "path",
        "title",
        "content",
        "folder",
        "tags",
        "favorite",
        "pinned",
        "created",
        "updated",
        "mtime",
        "links",
    ]
    if isinstance(row, sqlite3.Row):
        row = dict(row)
    d = dict(zip(keys, row))
    for key in ("tags", "links"):
        if isinstance(d.get(key), str):
            try:
                d[key] = json.loads(d[key])
            except Exception:
                d[key] = []
    d["favorite"] = bool(d.get("favorite"))
    d["pinned"] = bool(d.get("pinned"))
    return d


def notes(q: str, favorite: bool, db_path: Path) -> Tuple[int, List[Dict[str, Any]]]:
    """List notes, optionally filtered by favorite status."""
    query = q.strip().lower() if q else ""
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        if query:
            pat = f"%{query}%"
            rows = db.execute(
                "SELECT * FROM notes WHERE lower(title) LIKE ? OR lower(content) LIKE ? "
                "OR lower(tags) LIKE ? OR lower(folder) LIKE ? "
                "ORDER BY pinned DESC, updated DESC",
                (pat, pat, pat, pat),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM notes ORDER BY pinned DESC, updated DESC"
            ).fetchall()
        data = [_serialize(r) for r in rows]
        if favorite:
            data = [d for d in data if d["favorite"]]
        return 200, data


def search(q: str, folder: Optional[str], tag: Optional[str], db_path: Path) -> Tuple[int, List[Dict[str, Any]]]:
    """FTS5 search with LIKE fallback; supports folder and tag filters."""
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        if q:
            try:
                fts_rows = db.execute(
                    "SELECT path FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 200",
                    (q,),
                ).fetchall()
                paths = [r[0] for r in fts_rows]
                if paths:
                    rows = db.execute(
                        "SELECT * FROM notes WHERE path IN (%s)"
                        % ",".join("?" * len(paths)),
                        paths,
                    ).fetchall()
                else:
                    rows = []
            except sqlite3.OperationalError:
                pat = f"%{q.lower()}%"
                rows = db.execute(
                    "SELECT * FROM notes WHERE lower(title) LIKE ? OR lower(content) LIKE ?",
                    (pat, pat),
                ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM notes ORDER BY pinned DESC, updated DESC"
            ).fetchall()
        data = [_serialize(r) for r in rows]
        if folder:
            data = [d for d in data if d["folder"] == folder]
        if tag:
            data = [d for d in data if tag in d["tags"]]
        return 200, data


def mentions(title: str, db_path: Path) -> Tuple[int, List[Dict[str, Any]]]:
    """Find notes that mention a title but are not the note itself."""
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("SELECT * FROM notes").fetchall()
        title_lower = title.lower()
        result = []
        for r in rows:
            d = _serialize(r)
            if (
                d["title"] != title
                and title_lower in d["content"].lower()
                and title not in d["links"]
            ):
                result.append(d)
        return 200, result


def duplicates(db_path: Path) -> Tuple[int, List[List[Dict[str, Any]]]]:
    """Find notes with identical content (exact string match)."""
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("SELECT * FROM notes").fetchall()
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        content = _serialize(r)["content"]
        key = hashlib.sha1(content.lower().encode()).hexdigest()
        groups.setdefault(key, []).append(_serialize(r))
    result = [group for group in groups.values() if len(group) > 1]
    return 200, result


def backlinks(title: str, db_path: Path) -> Tuple[int, List[Dict[str, Any]]]:
    """Find notes that link to a title (in their 'links' field)."""
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("SELECT * FROM notes").fetchall()
    title_lower = title.lower()
    result = []
    for r in rows:
        d = _serialize(r)
        if (
            d["title"] != title
            and title_lower in d["content"].lower()
            and title in d["links"]
        ):
            result.append(d)
    return 200, result


def history(rel: str, vault_path: Path) -> Tuple[int, List[Dict[str, Any]]]:
    """Return history items for a note path."""
    target = history_dir(vault_path) / hashlib.sha1(rel.encode()).hexdigest()[:12]
    if not target.exists():
        return 200, []
    items = []
    for p in sorted(target.glob("*.md"), reverse=True):
        from datetime import datetime

        items.append(
            {
                "id": p.stem,
                "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
            }
        )
    return 200, items


def history_item(rel: str, hid: str, vault_path: Path) -> Tuple[int, Optional[Dict[str, Any]]]:
    """Read a specific history item."""
    target = (
        history_dir(vault_path)
        / hashlib.sha1(rel.encode()).hexdigest()[:12]
        / (hid + ".md")
    )
    if not target.exists():
        return 404, None
    return 200, {
        "id": hid,
        "content": target.read_text(encoding="utf-8", errors="replace"),
    }


def history_dir(vault_path: Path) -> Path:
    """Return the per-vault history directory, creating it if needed."""
    p = vault_path / ".portable-notes" / "history"
    p.mkdir(parents=True, exist_ok=True)
    return p