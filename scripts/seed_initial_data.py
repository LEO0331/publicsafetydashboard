from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import connect_db, now_ms

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed" / "initial_announcements.json"


def record_count() -> int:
    with connect_db() as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM offender_records WHERE is_hidden = 0").fetchone()
        return int(row["count"])


def seed_initial_data(if_empty: bool = False) -> int:
    if if_empty and record_count() > 0:
        return 0

    payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    inserted_records = 0
    with connect_db() as conn:
        for source in payload["sources"]:
            existing = conn.execute(
                "SELECT id FROM sources WHERE pdf_url = ? OR content_hash = ?",
                (source["pdfUrl"], source["contentHash"]),
            ).fetchone()
            if existing:
                source_id = int(existing["id"])
                conn.execute(
                    """
                    UPDATE sources
                    SET title = ?, source_url = ?, published_date = ?, content_hash = ?,
                        parse_status = 'parsed', parse_error = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        source["title"],
                        source["sourceUrl"],
                        source["publishedDate"],
                        source["contentHash"],
                        now_ms(),
                        source_id,
                    ),
                )
                conn.execute("DELETE FROM offender_records WHERE source_id = ?", (source_id,))
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
                        source["pdfUrl"],
                        source["publishedDate"],
                        now_ms(),
                        source["contentHash"],
                    ),
                )
                source_id = int(cur.lastrowid)

            for record in source["records"]:
                conn.execute(
                    """
                    INSERT INTO offender_records
                        (source_id, sequence_no, name, violation_date, law_article, location_text,
                         fact_text, violation_count, violation_types_json, alcohol_mg_per_l,
                         unlicensed, has_photo, parser_confidence, needs_review)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    ),
                )
                inserted_records += 1
    return inserted_records


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed bundled Taipei DOT announcement records.")
    parser.add_argument("--if-empty", action="store_true", help="Only seed when offender_records is empty.")
    args = parser.parse_args()
    count = seed_initial_data(if_empty=args.if_empty)
    print(f"Seeded {count} bundled records")


if __name__ == "__main__":
    main()
