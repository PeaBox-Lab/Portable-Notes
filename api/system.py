"""System-level endpoints: health check, index rebuild, vault export.

All functions are pure and accept explicit parameters for testability.
"""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple


def iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def health(vault_path: str, notes_count: int, version: str = "3.0.0") -> Tuple[int, Dict[str, Any]]:
    """Return the /api/health payload."""
    return 200, {
        "ok": True,
        "version": version,
        "vault": vault_path,
        "notes": notes_count,
    }


def rebuild(notes_count: int) -> Tuple[int, Dict[str, Any]]:
    """Return the /api/rebuild payload."""
    return 200, {"ok": True, "notes": notes_count}


def export_zip(vault_path: Path, version: str = "3.0.0") -> Tuple[int, bytes, str, str]:
    """Build a ZIP backup of the vault in memory.

    Returns (status, body_bytes, content_type, filename).
    The caller is responsible for writing the bytes to the HTTP response
    with the correct headers and filename.
    """
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(vault_path.rglob("*")):
            if p.is_file() and ".portable-notes" not in p.parts:
                z.write(p, p.relative_to(vault_path))
        z.writestr(
            "portable-notes-backup.json",
            json.dumps(
                {"version": version, "created": iso(), "vault": str(vault_path)},
                indent=2,
            ),
        )
    return 200, mem.getvalue(), "application/zip", "portable-notes-vault-backup.zip"
