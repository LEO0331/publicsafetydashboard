from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request

from common import USER_AGENT, connect_db, log_import, normalize_space, now_ms

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_DELAY_SECONDS = 5.0


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
        SELECT DISTINCT r.location_text
        FROM offender_records r
        LEFT JOIN geocoded_locations g ON g.location_text = r.location_text
        WHERE r.location_text IS NOT NULL
          AND r.location_text != ''
          AND (
            g.location_text IS NULL
            OR (g.lat IS NULL AND g.lng IS NULL AND COALESCE(g.error, '') != 'not_found')
          )
        ORDER BY r.location_text
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    with connect_db() as conn:
        return [row["location_text"] for row in conn.execute(sql).fetchall()]


def is_rate_limited(error: str | None) -> bool:
    if not error:
        return False
    return "429" in error or "too many requests" in error.lower()


def geocode_pending(limit: int | None = None, delay_seconds: float = DEFAULT_DELAY_SECONDS) -> int:
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
            if is_rate_limited(error):
                log_import("geocode_rate_limited stop_batch=true")
                break
            time.sleep(delay_seconds)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Geocode cached violation locations only.")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    args = parser.parse_args()
    print(f"Geocoded {geocode_pending(args.limit, args.delay)} locations")


if __name__ == "__main__":
    main()
