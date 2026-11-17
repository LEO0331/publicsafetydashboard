from __future__ import annotations

import base64
import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from announcement_download import validate_announcement_url
from common import ROOT

REVIEW_PATH = ROOT / "data" / "seed" / "announcement_reviews.json"


@dataclass(frozen=True)
class AnnouncementReview:
    action: str
    sha256: str
    previous_sha256: str | None = None
    retired_sha256: tuple[str, ...] = ()

    @property
    def blocked_digests(self) -> tuple[str, ...]:
        current = self.sha256 if self.action == "withdraw" else self.previous_sha256
        return ((current,) if current else ()) + self.retired_sha256


def checked_digest(value: str) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[a-f0-9]{64}", value) is None:
        raise ValueError("Reviewed announcements require a lowercase SHA-256 digest")
    return value


def is_public_announcement_pdf(url: str) -> bool:
    try:
        validate_announcement_url(url)
        parsed = urlsplit(url)
        path = parsed.path.lower()
        if path.endswith(".pdf"):
            return not parsed.query
        if path != "/download.ashx":
            return False
        pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        params = dict(pairs)
        if len(pairs) != 3 or set(params) != {"u", "n", "icon"} or params["icon"].lower() != ".pdf":
            return False
        for value in (params["u"], params["n"]):
            if not re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", value):
                return False
            padded = value + "=" * (-len(value) % 4)
            if not base64.b64decode(padded, validate=True).decode("utf-8").lower().endswith(".pdf"):
                return False
        return True
    except ValueError:
        return False


def load_reviews() -> dict[str, AnnouncementReview]:
    reviews: dict[str, AnnouncementReview] = {}
    for item in json.loads(REVIEW_PATH.read_text(encoding="utf-8")):
        url = item["pdfUrl"]
        if not is_public_announcement_pdf(url):
            raise ValueError("Reviewed announcements require a public Taipei PDF URL")
        action = item["action"]
        digest = checked_digest(item["sha256"])
        previous = None
        retired_values = item.get("retiredSha256", [])
        if not isinstance(retired_values, list):
            raise ValueError("retiredSha256 must be an array of digests")
        retired = tuple(checked_digest(value) for value in retired_values)
        if action == "replace":
            previous = checked_digest(item["previousSha256"])
        if (
            url in reviews or action not in ("replace", "withdraw") or previous == digest
            or digest in retired or previous in retired or len(retired) != len(set(retired))
        ):
            raise ValueError("Invalid or duplicate reviewed announcement")
        reviews[url] = AnnouncementReview(action, digest, previous, retired)
    return reviews


def withdrawn_or_superseded(
    reviews: dict[str, AnnouncementReview], url: str, digest: str | None
) -> bool:
    review = reviews.get(url)
    if review and review.action == "withdraw":
        return True
    return digest is not None and any(digest in item.blocked_digests for item in reviews.values())


def apply_withdrawals(conn: sqlite3.Connection, reviews: dict[str, AnnouncementReview]) -> None:
    for url, review in reviews.items():
        if review.action == "withdraw":
            conn.execute("DELETE FROM sources WHERE pdf_url = ?", (url,))
            conn.executemany("DELETE FROM sources WHERE content_hash = ?", [(digest,) for digest in review.blocked_digests])
