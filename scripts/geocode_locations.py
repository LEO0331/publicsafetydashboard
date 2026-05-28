from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request

from common import USER_AGENT, connect_db, log_import, normalize_space, now_ms

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def normalized_query(location_text: str) -> str:
    location = normalize_space(location_text)
    if location.startswith("臺北市") or location.startswith("台北市"):
        return location
    return f"臺北市 {location}"


def geocode(query: str) -> tuple[float | None, float | None, float | None, str | None]:
    params = urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": 1})
    req = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
    if not data:
        return None, None, None, "not_found"
    item = data[0]
    return float(item["lat"]), float(item["lon"]), float(item.get("importance") or 0), None


def pending_locations(limit: int | None = None) -> list[str]:
    sql = """
        SELECT DISTINCT location_text
        FROM offender_records
        WHERE location_text IS NOT NULL
          AND location_text != ''
          AND location_text NOT IN (SELECT location_text FROM geocoded_locations)
        ORDER BY location_text
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    with connect_db() as conn:
        return [row["location_text"] for row in conn.execute(sql).fetchall()]


def geocode_pending(limit: int | None = None, delay_seconds: float = 1.1) -> int:
    count = 0
    with connect_db() as conn:
        for location in pending_locations(limit):
            query = normalized_query(location)
            try:
                lat, lng, confidence, error = geocode(query)
            except Exception as exc:
                lat, lng, confidence, error = None, None, None, str(exc)
            conn.execute(
                """
                INSERT OR REPLACE INTO geocoded_locations
                    (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at, error)
                VALUES (?, ?, ?, ?, 'nominatim', ?, ?, ?)
                """,
                (location, query, lat, lng, confidence, now_ms(), error),
            )
            log_import(f"geocoded location={location} query={query} error={error or ''}")
            count += 1
            time.sleep(delay_seconds)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Geocode cached violation locations only.")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--delay", type=float, default=1.1)
    args = parser.parse_args()
    print(f"Geocoded {geocode_pending(args.limit, args.delay)} locations")


if __name__ == "__main__":
    main()
