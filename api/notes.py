"""Note lifecycle endpoints: CRUD, tree, folders, attachments.

All functions are pure and accept explicit parameters for testability.
"""

from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import re
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from core.vault import norm_rel, md_path, note_id, safe_name, parse_front, front, iso