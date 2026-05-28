from __future__ import annotations

import argparse
import json
import shutil
import urllib.request
from pathlib import Path

from common import DATA_DIR, USER_AGENT, connect_db, content_hash, ensure_dirs, log_import, now_ms
from parser import records_from_pdf


def download_pdf(url: str) -> tuple[Path, str]:
    ensure_dirs()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as res:
        content = res.read()
    digest = content_hash(content)
    path = DATA_DIR / "pdfs" / f"{digest}.pdf"
    path.write_bytes(content)
    log_import(f"pdf_downloaded url={url} hash={digest}")
    return path, digest


def copy_pdf(path: str) -> tuple[Path, str]:
    ensure_dirs()
    source = Path(path)
    content = source.read_bytes()
    digest = content_hash(content)
    target = DATA_DIR / "pdfs" / f"{digest}.pdf"
    if not target.exists():
        shutil.copyfile(source, target)
    log_import(f"pdf_copied file={source} hash={digest}")
    return target, digest


def ensure_source(pdf_url: str, title: str, digest: str) -> int:
    with connect_db() as conn:
        existing = conn.execute(
            "SELECT id FROM sources WHERE pdf_url = ? OR content_hash = ?",
            (pdf_url, digest),
        ).fetchone()
        if existing:
            return int(existing["id"])
        cur = conn.execute(
            """
            INSERT INTO sources
                (title, source_url, pdf_url, downloaded_at, content_hash, parse_status)
            VALUES (?, ?, ?, ?, ?, 'downloaded')
            """,
            (title, pdf_url, pdf_url, now_ms(), digest),
        )
        return int(cur.lastrowid)


def replace_records(source_id: int, pdf_path: Path) -> int:
    records = records_from_pdf(str(pdf_path))
    with connect_db() as conn:
        conn.execute("DELETE FROM offender_records WHERE source_id = ?", (source_id,))
        for record in records:
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
                    record.sequence_no,
                    record.name,
                    record.violation_date,
                    record.law_article,
                    record.location_text,
                    record.fact_text,
                    record.violation_count,
                    json.dumps(record.violation_types, ensure_ascii=False),
                    record.alcohol_mg_per_l,
                    record.unlicensed,
                    record.has_photo,
                    record.parser_confidence,
                    record.needs_review,
                ),
            )
        conn.execute(
            "UPDATE sources SET parse_status = 'parsed', parse_error = NULL, updated_at = ? WHERE id = ?",
            (now_ms(), source_id),
        )
    return len(records)


def import_pdf(url: str | None, file_path: str | None, title: str = "Manual PDF import") -> int:
    if url:
        pdf_path, digest = download_pdf(url)
        source_id = ensure_source(url, title, digest)
    elif file_path:
        pdf_path, digest = copy_pdf(file_path)
        source_id = ensure_source(f"file://{Path(file_path).resolve()}", title, digest)
    else:
        raise ValueError("Either --url or --file is required")
    try:
        count = replace_records(source_id, pdf_path)
    except Exception as exc:
        with connect_db() as conn:
            conn.execute(
                "UPDATE sources SET parse_status = 'error', parse_error = ?, updated_at = ? WHERE id = ?",
                (str(exc), now_ms(), source_id),
            )
        log_import(f"parse_error source_id={source_id} error={exc}")
        raise
    log_import(f"pdf_imported source_id={source_id} records={count}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Import and parse one Taipei DOT PDF.")
    parser.add_argument("--url")
    parser.add_argument("--file")
    parser.add_argument("--title", default="Manual PDF import")
    args = parser.parse_args()
    count = import_pdf(args.url, args.file, args.title)
    print(f"Imported {count} records")


if __name__ == "__main__":
    main()
