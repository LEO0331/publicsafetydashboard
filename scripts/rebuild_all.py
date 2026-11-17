from __future__ import annotations

import argparse

from announcement_download import validate_announcement_url
from announcement_reviews import apply_withdrawals, checked_digest, load_reviews, withdrawn_or_superseded
from common import DATA_DIR, connect_db, log_import
from crawl_sources import crawl
from geocode_locations import geocode_pending
from import_pdf import import_pdf


def rebuild(max_pages: int | None = None, limit_sources: int | None = None) -> None:
    reviews = load_reviews()
    inserted = crawl(max_pages=max_pages)
    log_import(f"rebuild_crawl inserted={inserted}")
    with connect_db() as conn:
        apply_withdrawals(conn, reviews)
        sql = "SELECT id, title, pdf_url, content_hash FROM sources ORDER BY published_date DESC, id DESC"
        if limit_sources:
            sql += f" LIMIT {int(limit_sources)}"
        rows = conn.execute(sql).fetchall()
    for row in rows:
        url, digest = row["pdf_url"], row["content_hash"]
        if url.startswith(("local-pdf:", "file://")):
            if withdrawn_or_superseded(reviews, url, digest):
                continue
            digest = checked_digest(digest)
            cached_file = DATA_DIR / "pdfs" / f"{digest}.pdf"
            if not cached_file.is_symlink() and cached_file.is_file():
                import_pdf(None, str(cached_file), row["title"], expected_sha256=digest)
            else:
                log_import(f"rebuild_local_pdf_unavailable source_id={row['id']}")
        else:
            try:
                validate_announcement_url(url)
            except ValueError:
                log_import(f"rebuild_url_not_approved source_id={row['id']}")
                continue
            if url in reviews or not withdrawn_or_superseded(reviews, url, digest):
                import_pdf(url, None, row["title"])
    geocode_pending()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild crawler, parser, and geocode cache.")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--limit-sources", type=int)
    args = parser.parse_args()
    rebuild(args.max_pages, args.limit_sources)


if __name__ == "__main__":
    main()
