from __future__ import annotations

import argparse
import json
from pathlib import Path

from announcement_reviews import apply_withdrawals, load_reviews, withdrawn_or_superseded
from common import connect_db, now_ms
from record_visibility import replacement_visibility

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed" / "initial_announcements.json"


def seed_initial_data(if_empty: bool = False, for_refresh: bool = False) -> int:
    reviews = load_reviews()
    replacements = {url: review for url, review in reviews.items() if review.action == "replace"}
    inserted_records = 0
    with connect_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        already_seeded = if_empty and conn.execute("SELECT 1 FROM offender_records LIMIT 1").fetchone() is not None
        apply_withdrawals(conn, reviews)
        if already_seeded and not replacements:
            return 0

        sources = json.loads(SEED_PATH.read_text(encoding="utf-8"))["sources"]
        if not for_refresh:
            seed_digests = {source["pdfUrl"]: source["contentHash"] for source in sources}
            if any(seed_digests.get(url) != review.sha256 for url, review in replacements.items()):
                raise ValueError("Reviewed replacement is missing from the announcement seed")
        for source in sources:
            url = source["pdfUrl"]
            digest = source["contentHash"]
            review = replacements.get(url)
            if already_seeded and not review:
                continue
            if withdrawn_or_superseded(reviews, url, digest) and not (
                for_refresh and review and review.previous_sha256 == digest
            ):
                continue
            stale_sources = []
            if review and not for_refresh:
                for stale_digest in review.blocked_digests:
                    stale = conn.execute(
                        "SELECT id, content_hash, is_hidden FROM sources WHERE content_hash = ?", (stale_digest,)
                    ).fetchone()
                    if stale:
                        stale_sources.append(stale)
            existing = conn.execute(
                """
                SELECT id, content_hash, is_hidden FROM sources
                WHERE pdf_url = ? OR content_hash = ?
                ORDER BY pdf_url = ? DESC
                LIMIT 1
                """,
                (url, digest, url),
            ).fetchone()
            if existing is None and stale_sources:
                existing = stale_sources[0]
            if existing:
                if already_seeded and existing["content_hash"] == digest and not stale_sources:
                    continue
                source_id = int(existing["id"])
                conn.execute(
                    """
                    UPDATE sources
                    SET title = ?, source_url = ?, published_date = ?, content_hash = ?,
                        pdf_url = COALESCE(?, pdf_url), parse_status = 'parsed', is_hidden = ?,
                        parse_error = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        source["title"],
                        source["sourceUrl"],
                        source["publishedDate"],
                        digest,
                        url if review and not for_refresh else None,
                        existing["is_hidden"] or any(stale["is_hidden"] for stale in stale_sources),
                        now_ms(),
                        source_id,
                    ),
                )
            else:
                cur = conn.execute(
                    """
                    INSERT INTO sources
                        (title, source_url, pdf_url, published_date, downloaded_at, content_hash, parse_status)
                    VALUES (?, ?, ?, ?, ?, ?, 'parsed')
                    """,
                    (
                        source["title"],
                        source["sourceUrl"],
                        url,
                        source["publishedDate"],
                        now_ms(),
                        digest,
                    ),
                )
                source_id = int(cur.lastrowid)

            records = source["records"]
            identities = [(record["sequenceNo"], record["name"], record["violationDate"]) for record in records]
            flags = replacement_visibility(conn, source_id, identities)
            for stale in stale_sources:
                if stale["id"] == source_id:
                    continue
                alias_flags = replacement_visibility(conn, stale["id"], identities)
                flags = [hidden or alias_hidden for hidden, alias_hidden in zip(flags, alias_flags, strict=True)]
                conn.execute("DELETE FROM sources WHERE id = ?", (stale["id"],))
            conn.execute("DELETE FROM offender_records WHERE source_id = ?", (source_id,))
            for record, hidden in zip(records, flags, strict=True):
                conn.execute(
                    """
                    INSERT INTO offender_records
                        (source_id, sequence_no, name, violation_date, law_article, location_text,
                         fact_text, violation_count, violation_types_json, alcohol_mg_per_l,
                         unlicensed, has_photo, parser_confidence, needs_review, is_hidden)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        source_id,
                        record["sequenceNo"],
                        record["name"],
                        record["violationDate"],
                        record["lawArticle"],
                        record["locationText"],
                        record["factText"],
                        record["violationCount"],
                        json.dumps(record["violationTypes"], ensure_ascii=False),
                        record["alcoholMgPerL"],
                        record["unlicensed"],
                        record["hasPhoto"],
                        record["parserConfidence"],
                        record["needsReview"],
                        hidden,
                    ),
                )
                inserted_records += 1
    return inserted_records


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed bundled Taipei DOT announcement records.")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--if-empty", action="store_true", help="Seed an empty database and apply reviewed changes.")
    modes.add_argument("--for-refresh", action="store_true", help="Load a temporary refresh database from the prior seed.")
    args = parser.parse_args()
    count = seed_initial_data(if_empty=args.if_empty, for_refresh=args.for_refresh)
    print(f"Seeded {count} bundled records")


if __name__ == "__main__":
    main()
