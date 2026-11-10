"""Vault and data-access helpers for Portable Notes.

Extracted from ``app.py`` so that the route modules in ``api/`` can
depend on them without importing the compatibility host. No circular
imports: this module only imports from the standard library and
``core.errors``.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from .errors import AppError

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
DATA = ROOT / "data"
DEFAULT_VAULT = ROOT / "vault"
CONFIG = DATA / "config.json"
DB = DATA / "index.db"
DATA.mkdir(exist_ok=True)

RESERVED = {"Templates", "Attachments", ".portable-notes"}


def iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_name(value, fallback="Untitled"):
    value = re.sub(r'[<>:"/\|?*\x00-\x1f]', "", str(value)).strip().rstrip(".")
    return (value[:120] or fallback)


def norm_rel(value):
    raw = str(value or "").replace("\\", "/")
    if raw.startswith("/") or re.match(r"^[A-Za-z]:/", raw):
        raise ValueError("Invalid path")
    value = raw.strip("/")
    p = Path(value)
    if value.startswith(".") or ".." in p.parts:
        raise ValueError("Invalid path")
    return value


def load_cfg():
    default = {"vault": str(DEFAULT_VAULT), "theme": "system", "version": "3.1.0"}
    if CONFIG.exists():
        try:
            default.update(json.loads(CONFIG.read_text(encoding="utf-8")))
        except Exception:
            pass
    return default


CFG = load_cfg()


def save_cfg():
    CONFIG.write_text(json.dumps(CFG, indent=2), encoding="utf-8")


def vault():
    p = Path(CFG["vault"]).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def md_path(rel):
    rel = norm_rel(rel)
    p = (vault() / rel).resolve()
    if vault() not in p.parents:
        raise ValueError("Outside vault")
    return p


def parse_front(text):
    meta = {}
    body = text
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end >= 0:
            raw = text[4:end]
            body = text[end + 5 :]
            current = None
            for line in raw.splitlines():
                if re.match(r"^\s+-\s+", line) and current:
                    meta.setdefault(current, []).append(line.split("-", 1)[1].strip())
                elif ":" in line:
                    k, v = line.split(":", 1)
                    current = k.strip()
                    v = v.strip()
                    if not v:
                        meta[current] = []
                    elif v.startswith("[") and v.endswith("]"):
                        meta[current] = [
                            x.strip().strip('"') for x in v[1:-1].split(",") if x.strip()
                        ]
                    else:
                        meta[current] = v.strip('"')
    return meta, body


def front(meta, body):
    tags = meta.get("tags", [])
    tags = tags if isinstance(tags, list) else [x.strip() for x in str(tags).split(",") if x.strip()]
    lines = [
        "---",
        f"id: {meta.get('id', '')}",
        f"title: {meta.get('title', 'Untitled')}",
        f"created: {meta.get('created', iso())}",
        f"updated: {meta.get('updated', iso())}",
        "tags:",
    ] + [f"  - {x}" for x in tags]
    lines += [
        f"favorite: {str(bool(meta.get('favorite', False))).lower()}",
        f"pinned: {str(bool(meta.get('pinned', False))).lower()}",
        "---",
        "",
    ]
    return "\n".join(lines) + body.lstrip("\n")


def note_id(rel):
    return hashlib.sha1(rel.encode()).hexdigest()[:16]


def boolv(v):
    return str(v).lower() in ("1", "true", "yes", "on")


def init_db():
    with sqlite3.connect(DB) as db:
        db.executescript(
            """CREATE TABLE IF NOT EXISTS notes(path TEXT PRIMARY KEY,title TEXT,content TEXT,folder TEXT,tags TEXT,favorite INTEGER,pinned INTEGER,created TEXT,updated TEXT,mtime REAL,links TEXT); CREATE INDEX IF NOT EXISTS idx_title ON notes(title);"""
        )
        try:
            db.execute(
                "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(path UNINDEXED,title,content,tags,folder)"
            )
        except sqlite3.OperationalError:
            pass


def index_note(p):
    rel = p.relative_to(vault()).as_posix()
    text = p.read_text(encoding="utf-8", errors="replace")
    meta, body = parse_front(text)
    title = str(meta.get("title") or p.stem)
    tags = meta.get("tags", [])
    tags = tags if isinstance(tags, list) else [x.strip() for x in str(tags).split(",") if x.strip()]
    links = re.findall(r"\[\[([^\]]|#]+)", body)
    folder = p.parent.relative_to(vault()).as_posix()
    folder = "" if folder == "." else folder
    item = (
        rel,
        title,
        body,
        folder,
        json.dumps(tags),
        int(boolv(meta.get("favorite"))),
        int(boolv(meta.get("pinned"))),
        meta.get("created", ""),
        meta.get("updated", ""),
        p.stat().st_mtime,
        json.dumps(links),
    )
    with sqlite3.connect(DB) as db:
        db.execute("INSERT OR REPLACE INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)", item)
        try:
            db.execute("DELETE FROM notes_fts WHERE path = ?", (rel,))
            db.execute(
                "INSERT INTO notes_fts VALUES(?,?,?,?,?)",
                (rel, title, body, " ".join(tags), folder),
            )
        except sqlite3.OperationalError:
            pass
    return serialize(item)


def serialize(row):
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
        d = dict(row)
    else:
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


def rebuild():
    init_db()
    found = []
    for p in vault().rglob("*.md"):
        if ".portable-notes" not in p.parts:
            found.append(p.relative_to(vault()).as_posix())
            index_note(p)
    with sqlite3.connect(DB) as db:
        if found:
            db.execute(
                "DELETE FROM notes WHERE path NOT IN (%s)" % ",".join("?" * len(found)),
                found,
            )
        else:
            db.execute("DELETE FROM notes")
    return len(found)


def orphan_attachments():
    """Find attachments not referenced by any note.

    Returns list of dicts with 'path', 'name', 'size', 'age_days'.
    """
    vault_path = vault()
    attach_dir = vault_path / "Attachments"
    if not attach_dir.exists():
        return []

    ref_attachments = set()
    from urllib.parse import unquote

    def add_ref(raw):
        ref = unquote((raw or '').strip().split('#')[0].split('?')[0])
        if not ref:
            return
        ref_attachments.add(ref)
        ref_attachments.add(ref.replace('\\', '/'))
        ref_attachments.add(ref.replace('\\', '/').split('/')[-1])

    with sqlite3.connect(DATA / "index.db") as db:
        rows = db.execute("SELECT path, content FROM notes").fetchall()
        for row in rows:
            content = row[1] or ""
            import re
            # Markdown links/images: [alt](path) or ![alt](path)
            for m in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)', content):
                add_ref(m.group(1))
            # Wiki embeds/links: ![[path|label]] or [[path]]
            for m in re.finditer(r'!?\[\[([^\]]+)\]\]', content):
                add_ref(m.group(1).split('|')[0])

    attach_files = {}
    for p in attach_dir.rglob("*"):
        if p.is_file():
            rel = p.relative_to(vault_path).as_posix()
            name = p.name
            if rel not in ref_attachments and name not in ref_attachments:
                attach_files[name] = {
                    "path": p.relative_to(vault_path).as_posix(),
                    "name": name,
                    "size": p.stat().st_size,
                    "age_days": (datetime.now() - datetime.fromtimestamp(p.stat().st_mtime)).days,
                }

    result = sorted(attach_files.values(), key=lambda x: x["age_days"], reverse=True)
    return result


def refresh():
    init_db()
    with sqlite3.connect(DB) as db:
        known = {r[0]: r[1] for r in db.execute("SELECT path, mtime FROM notes")}
    actual = {}
    for p in vault().rglob("*.md"):
        rel = p.relative_to(vault()).as_posix()
        actual[rel] = p.stat().st_mtime
        if rel not in known or abs(known[rel] - actual[rel]) > 0.0001:
            index_note(p)
    removed = set(known) - set(actual)
    if removed:
        with sqlite3.connect(DB) as db:
            for rel in removed:
                db.execute("DELETE FROM notes WHERE path = ?", (rel,))


def seed():
    p = vault() / "Getting Started" / "Welcome.md"
    if not any(vault().rglob("*.md")):
        p.parent.mkdir(parents=True, exist_ok=True)
        t = iso()
        p.write_text(
            front(
                {
                    "id": note_id("Getting Started/Welcome.md"),
                    "title": "Welcome to Portable Notes",
                    "created": t,
                    "updated": t,
                    "tags": ["welcome", "guide"],
                    "favorite": True,
                    "pinned": True,
                },
                """# Welcome\n\nPortable Notes 2.1 uses **Markdown files as the source of truth**.\n\n## Try it\n\n- Create a note with **Ctrl+N**\n- Link notes with [[Roadmap]]\n- Add tags in the properties bar\n- Use **Ctrl+Shift+P** for the command palette\n- Export a portable ZIP backup\n\n- [ ] Create your first note\n""",
            ),
            encoding="utf-8",
        )
        tp = vault() / "Templates" / "Meeting.md"
        tp.parent.mkdir(parents=True, exist_ok=True)
        tp.write_text(
            "# {{title}}\n\n**Date:** {{date}}\n\n## Attendees\n\n## Agenda\n\n## Notes\n\n## Actions\n\n- [ ]\n",
            encoding="utf-8",
        )


def history_dir():
    p = vault() / ".portable-notes" / "history"
    p.mkdir(parents=True, exist_ok=True)
    return p


def snapshot(rel, text):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = history_dir() / hashlib.sha1(rel.encode()).hexdigest()[:12]
    target.mkdir(parents=True, exist_ok=True)
    (target / (stamp + ".md")).write_text(text, encoding="utf-8")
    snaps = sorted(target.glob("*.md"), reverse=True)
    for old in snaps[20:]:
        old.unlink(missing_ok=True)


def note_history(rel):
    target = history_dir() / hashlib.sha1(rel.encode()).hexdigest()[:12]
    if not target.exists():
        return []
    return [
        {"id": p.stem, "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat()}
        for p in sorted(target.glob("*.md"), reverse=True)
    ]
