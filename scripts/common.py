from __future__ import annotations

import hashlib
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("SQLITE_PATH", str(ROOT / "drizzle" / "dev.db")))
DATA_DIR = ROOT / "data"
LOG_DIR = ROOT / "logs"
USER_AGENT = "TaipeiTrafficSafetyEducationDashboard/0.1 (local educational importer; contact: local-dev)"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    (DATA_DIR / "pdfs").mkdir(exist_ok=True)
    LOG_DIR.mkdir(exist_ok=True)


def connect_db() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def log_import(message: str) -> None:
    ensure_dirs()
    timestamp = datetime.now(timezone.utc).isoformat()
    with (LOG_DIR / "import.log").open("a", encoding="utf-8") as fh:
        fh.write(f"{timestamp} {message}\n")


def parse_taiwan_date(value: str | None) -> Optional[int]:
    if not value:
        return None
    text = value.strip()
    patterns = [
        r"(?P<year>\d{2,4})[./-](?P<month>\d{1,2})[./-](?P<day>\d{1,2})",
        r"(?P<year>\d{2,4})\s*年\s*(?P<month>\d{1,2})\s*月\s*(?P<day>\d{1,2})\s*日?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        year = int(match.group("year"))
        if year < 1911:
            year += 1911
        try:
            dt = datetime(year, int(match.group("month")), int(match.group("day")), tzinfo=timezone.utc)
        except ValueError:
            return None
        return int(dt.timestamp() * 1000)
    return None


def normalize_space(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()
