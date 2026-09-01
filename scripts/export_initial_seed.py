from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from common import ROOT

OUTPUT_PATH = ROOT / "data" / "seed" / "initial_announcements.json"
SOURCE_URL = "https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170"
GENERATED_FROM = (
    "Taipei DOT public PDF announcements from the official 酒駕及拒測累犯公布專區 "
    "PageSize=105 listing; seed includes matching regular 公布名單 PDFs and excludes the "
    "separate 三次以上且設籍本市者 subtype. It stores parsed rows only, not PDF binaries or photos."
)


def export_initial_seed(db_path: Path, output_path: Path = OUTPUT_PATH) -> tuple[int, int]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        sources = connection.execute(
            """
            SELECT id, title, pdf_url, published_date, content_hash
            FROM sources
            WHERE parse_status = 'parsed'
              AND title NOT LIKE '%三次以上%'
            ORDER BY published_date DESC, id DESC
            """
        ).fetchall()
        payload_sources = []
        record_count = 0
        for source in sources:
            records = connection.execute(
                """
                SELECT sequence_no, name, violation_date, law_article, location_text, fact_text,
                       violation_count, violation_types_json, alcohol_mg_per_l, unlicensed,
                       has_photo, parser_confidence, needs_review
                FROM offender_records
                WHERE source_id = ?
                ORDER BY id
                """,
                (source["id"],),
            ).fetchall()
            payload_records = [
                {
                    "sequenceNo": record["sequence_no"],
                    "name": record["name"],
                    "violationDate": record["violation_date"],
                    "lawArticle": record["law_article"],
                    "locationText": record["location_text"],
                    "factText": record["fact_text"],
                    "violationCount": record["violation_count"],
                    "violationTypes": json.loads(record["violation_types_json"] or "[]"),
                    "alcoholMgPerL": record["alcohol_mg_per_l"],
                    "unlicensed": bool(record["unlicensed"]),
                    "hasPhoto": bool(record["has_photo"]),
                    "parserConfidence": record["parser_confidence"],
                    "needsReview": bool(record["needs_review"]),
                }
                for record in records
            ]
            record_count += len(payload_records)
            payload_sources.append(
                {
                    "title": source["title"],
                    "sourceUrl": SOURCE_URL,
                    "pdfUrl": source["pdf_url"],
                    "publishedDate": source["published_date"],
                    "contentHash": source["content_hash"],
                    "records": payload_records,
                }
            )
    finally:
        connection.close()

    payload = {"version": 4, "generatedFrom": GENERATED_FROM, "sources": payload_sources}
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(payload_sources), record_count


if __name__ == "__main__":
    source_count, record_count = export_initial_seed(ROOT / "drizzle" / "dev.db")
    print(f"Exported {source_count} sources and {record_count} records")
