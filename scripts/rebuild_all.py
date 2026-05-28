from __future__ import annotations

import argparse

from crawl_sources import crawl
from geocode_locations import geocode_pending
from import_pdf import import_pdf
from common import connect_db, log_import


def rebuild(max_pages: int | None = None, limit_sources: int | None = None) -> None:
    inserted = crawl(max_pages=max_pages)
    log_import(f"rebuild_crawl inserted={inserted}")
    with connect_db() as conn:
        sql = "SELECT title, pdf_url FROM sources ORDER BY published_date DESC, id DESC"
        if limit_sources:
            sql += f" LIMIT {int(limit_sources)}"
        rows = conn.execute(sql).fetchall()
    for row in rows:
        import_pdf(row["pdf_url"], None, row["title"])
    geocode_pending()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild crawler, parser, and geocode cache.")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--limit-sources", type=int)
    args = parser.parse_args()
    rebuild(args.max_pages, args.limit_sources)


if __name__ == "__main__":
    main()
