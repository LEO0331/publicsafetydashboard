from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path
from sqlite3 import Connection

from announcement_download import MAX_PDF_BYTES, PDF_HOSTS, fetch_announcement, read_bounded
from announcement_reviews import load_reviews, withdrawn_or_superseded
from common import DATA_DIR, connect_db, content_hash, ensure_dirs, log_import, now_ms
from pdf_parser import ParsedRecord, records_from_pdf
from record_visibility import replacement_visibility


def store_pdf(content: bytes) -> tuple[Path, str]:
    if b"%PDF-" not in content[:1024]:
        raise ValueError("The imported file must be a PDF")
    ensure_dirs()
    digest = content_hash(content)
    target = DATA_DIR / "pdfs" / f"{digest}.pdf"
    if not target.exists():
        staged = tempfile.NamedTemporaryFile(dir=target.parent, delete=False)
        staged_path = Path(staged.name)
        try:
            with staged:
                staged.write(content)
            try:
                staged_path.replace(target)
            except PermissionError:
                if not target.is_file():
                    raise
        finally:
            staged_path.unlink(missing_ok=True)
    return target, digest


def download_pdf(url: str) -> tuple[Path, str]:
    result = store_pdf(fetch_announcement(url, PDF_HOSTS, MAX_PDF_BYTES, timeout=60))
    log_import(f"pdf_downloaded hash={result[1]}")
    return result


def copy_pdf(path: str) -> tuple[Path, str]:
    with Path(path).open("rb") as source:
        result = store_pdf(read_bounded(source, MAX_PDF_BYTES))
    log_import(f"pdf_copied hash={result[1]}")
    return result


def ensure_source(conn: Connection, pdf_url: str, title: str, digest: str) -> int:
    matches = conn.execute(
        """
        SELECT id, content_hash, is_hidden FROM sources
        WHERE pdf_url = ? OR content_hash = ? ORDER BY pdf_url = ? DESC
        """,
        (pdf_url, digest, pdf_url),
    ).fetchall()
    if matches:
        existing = matches[0]
        if len(matches) == 2:
            if existing["content_hash"] is not None or existing["is_hidden"] or conn.execute(
                "SELECT 1 FROM offender_records WHERE source_id = ? LIMIT 1", (existing["id"],)
            ).fetchone():
                raise ValueError("The same PDF is linked to two existing sources; review the duplicates first")
            conn.execute("DELETE FROM sources WHERE id = ?", (existing["id"],))
            existing = matches[1]
        source_id = int(existing["id"])
        conn.execute(
            """
            UPDATE sources
            SET title = ?, downloaded_at = ?, content_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (title, now_ms(), digest, now_ms(), source_id),
        )
        return source_id
    cur = conn.execute(
        """
        INSERT INTO sources
            (title, source_url, pdf_url, downloaded_at, content_hash)
        VALUES (?, ?, ?, ?, ?)
        """,
        (title, pdf_url, pdf_url, now_ms(), digest),
    )
    return int(cur.lastrowid)


def replace_records(conn: Connection, source_id: int, records: list[ParsedRecord]) -> None:
    flags = replacement_visibility(
        conn, source_id, ((record.sequence_no, record.name, record.violation_date) for record in records)
    )
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
                hidden,
            ),
        )
    conn.execute(
        "UPDATE sources SET parse_status = 'parsed', parse_error = NULL, updated_at = ? WHERE id = ?",
        (now_ms(), source_id),
    )


def import_pdf(
    url: str | None, file_path: str | None, title: str = "Manual PDF import", *, expected_sha256: str | None = None
) -> int:
    reviews = load_reviews()
    if url:
        if withdrawn_or_superseded(reviews, url, None):
            raise ValueError("Announcement has been withdrawn")
        pdf_path, digest = download_pdf(url)
    elif file_path:
        pdf_path, digest = copy_pdf(file_path)
    else:
        raise ValueError("Either --url or --file is required")

    identity = url or f"local-pdf:{digest}"
    review = reviews.get(identity)
    if withdrawn_or_superseded(reviews, identity, digest) or (review and digest != review.sha256):
        raise ValueError("PDF does not match the reviewed announcement")
    if expected_sha256 and digest != expected_sha256:
        raise ValueError("Cached PDF content does not match its stored digest")

    try:
        records = records_from_pdf(str(pdf_path))
        if not records:
            raise ValueError("PDF contains no parsed records")
        with connect_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            source_id = ensure_source(conn, identity, title, digest)
            replace_records(conn, source_id, records)
    except Exception as exc:
        log_import(f"parse_error hash={digest} error={type(exc).__name__}")
        raise
    log_import(f"pdf_imported source_id={source_id} records={len(records)}")
    return len(records)


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
