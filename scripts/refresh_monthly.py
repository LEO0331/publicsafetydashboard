"""Refresh parsed announcements first, then enrich the map independently."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from common import connect_db
from crawl_sources import crawl
from export_geocode_cache import export_geocode_cache
from export_initial_seed import export_initial_seed
from geocode_locations import geocode_pending_summary, normalized_query
from import_pdf import import_pdf


def published_locations() -> set[str]:
    with connect_db() as conn:
        return {
            row[0]
            for row in conn.execute(
                "SELECT DISTINCT location_text FROM offender_records "
                "WHERE location_text IS NOT NULL AND location_text != ''"
            )
        }


def dashboard_counts() -> dict[str, int | str | None]:
    with connect_db() as conn:
        totals = conn.execute("SELECT COUNT(*) AS records FROM offender_records").fetchone()
        # The cache is keyed by normalized query, while published strings stay intact.
        cached_queries = {
            row[0]
            for row in conn.execute(
                "SELECT normalized_query FROM geocoded_locations WHERE lat IS NOT NULL AND lng IS NOT NULL"
            )
        }
        locations = {
            row[0]
            for row in conn.execute(
                "SELECT DISTINCT location_text FROM offender_records "
                "WHERE location_text IS NOT NULL AND location_text != ''"
            )
        }
        mapped = sum(normalized_query(location) in cached_queries for location in locations)
        latest = conn.execute(
            "SELECT title FROM sources WHERE parse_status = 'parsed' "
            "ORDER BY published_date DESC, id DESC LIMIT 1"
        ).fetchone()
    return {
        "total_records": totals["records"],
        "unique_locations": len(locations),
        "mapped_locations": mapped,
        "unmapped_locations": len(locations) - mapped,
        "latest_announcement": latest[0] if latest else None,
    }


def refresh_monthly(max_pages: int = 3, geocode_limit: int = 25, geocode_delay: float = 16.0) -> dict:
    if max_pages < 1 or geocode_limit < 0 or geocode_delay < 0:
        raise ValueError("max-pages must be positive; geocode-limit and geocode-delay must be nonnegative")

    before_locations = published_locations()
    with connect_db() as conn:
        existing_urls = {row[0] for row in conn.execute("SELECT pdf_url FROM sources")}

    crawl(page_size=105, max_pages=max_pages)
    with connect_db() as conn:
        new_sources = conn.execute(
            "SELECT title, pdf_url FROM sources WHERE parse_status = 'discovered' "
            "ORDER BY published_date, id"
        ).fetchall()
    new_sources = [row for row in new_sources if row["pdf_url"] not in existing_urls]
    parsed_records = 0
    for source in new_sources:
        count = import_pdf(source["pdf_url"], None, source["title"])
        if count <= 0:
            raise ValueError(f"Announcement parsed with no records: {source['title']}")
        parsed_records += count

    with connect_db() as conn:
        invalid = conn.execute(
            "SELECT title FROM sources WHERE parse_status = 'parsed' "
            "AND (content_hash IS NULL OR content_hash = '') LIMIT 1"
        ).fetchone()
    if invalid:
        raise ValueError(f"Parsed announcement missing content hash: {invalid['title']}")

    source_count, exported_records = export_initial_seed(Path(os.environ.get("SQLITE_PATH", "drizzle/dev.db")))
    new_locations = published_locations() - before_locations
    with connect_db() as conn:
        cached_queries = {
            row[0]
            for row in conn.execute("SELECT normalized_query FROM geocoded_locations")
        }
    already_cached = sum(normalized_query(location) in cached_queries for location in new_locations)

    geocode = {"attempted": 0, "success": 0, "not_found": 0, "deferred": 0, "remaining": 0}
    geocode_error = None
    try:
        geocode = geocode_pending_summary(limit=geocode_limit, delay_seconds=geocode_delay)
        export_geocode_cache()
    except Exception as exc:
        # Parsed official data is publishable even when map enrichment fails.
        geocode_error = str(exc)

    return {
        "new_announcements": len(new_sources),
        "new_parsed_records": parsed_records,
        "new_unique_locations": len(new_locations),
        "already_cached": already_cached,
        "geocode": geocode,
        "geocode_error": geocode_error,
        "seed_sources": source_count,
        "seed_records": exported_records,
        **dashboard_counts(),
    }


def summary_markdown(result: dict) -> str:
    geo = result["geocode"]
    return "\n".join(
        [
            "## Taipei DOT monthly refresh",
            "",
            f"Latest eligible announcement: {result['latest_announcement'] or 'none'}",
            f"New announcements: {result['new_announcements']}",
            f"New parsed records: {result['new_parsed_records']}",
            "",
            f"New unique locations: {result['new_unique_locations']}",
            f"Already cached: {result['already_cached']}",
            f"Geocoded successfully: {geo.get('success', 0)}",
            f"Not found: {geo.get('not_found', 0)}",
            f"Deferred/transient: {geo.get('deferred', 0)}",
            f"Remaining pending: {geo.get('remaining', 0)}",
            f"Geocoder error: {result['geocode_error'] or 'none'}",
            "",
            f"Total dashboard records: {result['total_records']}",
            f"Unique published locations: {result['unique_locations']}",
            f"Mapped locations: {result['mapped_locations']}",
            f"Unmapped locations: {result['unmapped_locations']}",
        ]
    ) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--geocode-limit", type=int, default=int(os.environ.get("MONTHLY_GEOCODE_LIMIT", "25")))
    parser.add_argument("--geocode-delay", type=float, default=float(os.environ.get("GEOCODE_DELAY_SECONDS", "16")))
    args = parser.parse_args()
    result = refresh_monthly(args.max_pages, args.geocode_limit, args.geocode_delay)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    summary = summary_markdown(result)
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as output:
            output.write(summary)


if __name__ == "__main__":
    main()
