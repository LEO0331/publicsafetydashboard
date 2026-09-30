from __future__ import annotations

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable

from common import USER_AGENT, connect_db, log_import, normalize_space, now_ms

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_PROVIDER_URL = os.environ.get("GEOCODE_PROVIDER_URL", NOMINATIM_URL)
DEFAULT_DELAY_SECONDS = float(os.environ.get("GEOCODE_DELAY_SECONDS", "16"))
DEFAULT_BATCH_LIMIT = int(os.environ.get("MONTHLY_GEOCODE_LIMIT", "25"))


def normalized_query(location_text: str) -> str:
    location = normalize_space(location_text)
    if location.startswith(("臺北市", "台北市")):
        return location
    return f"臺北市 {location}"


def geocode(query: str, provider_url: str = DEFAULT_PROVIDER_URL) -> tuple[float | None, float | None, float | None, str | None]:
    params = urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": 1})
    separator = "&" if "?" in provider_url else "?"
    req = urllib.request.Request(
        f"{provider_url}{separator}{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
    if not data:
        return None, None, None, "not_found"
    item = data[0]
    return float(item["lat"]), float(item["lon"]), float(item.get("importance") or 0), None


def _location_work(candidate_locations: Iterable[str] | None = None,
                   retry_not_found: bool = False) -> tuple[list[tuple[str, str]], int, int]:
    """Return one candidate per query and counts for published location strings."""
    with connect_db() as conn:
        published = {row[0] for row in conn.execute(
            "SELECT DISTINCT location_text FROM offender_records "
            "WHERE location_text IS NOT NULL AND TRIM(location_text) != ''"
        )}
        cache = {
            row[0]: (row[1], row[2], row[3])
            for row in conn.execute("SELECT normalized_query, lat, lng, error FROM geocoded_locations")
        }
    locations = sorted(published if candidate_locations is None else published.intersection(candidate_locations))
    candidates: dict[str, str] = {}
    unseen_queries: set[str] = set()
    cached = 0
    for location in locations:
        query = normalized_query(location)
        existing = cache.get(query)
        if existing is None:
            unseen_queries.add(query)
        elif existing[0] is not None and existing[1] is not None:
            cached += 1
            continue
        elif existing[2] == "not_found" and not retry_not_found:
            continue
        candidates.setdefault(query, location)
    return [(location, query) for query, location in candidates.items()], len(unseen_queries), cached


def pending_locations(limit: int | None = None, retry_not_found: bool = False,
                      candidate_locations: Iterable[str] | None = None) -> list[str]:
    candidates, _, _ = _location_work(candidate_locations, retry_not_found)
    return [location for location, _ in (candidates[:limit] if limit is not None else candidates)]


def is_rate_limited(error: str | None) -> bool:
    return bool(error and ("429" in error or "too many requests" in error.lower()))


def _cache_result(location: str, query: str, lat: float | None, lng: float | None,
                  confidence: float | None, error: str | None) -> None:
    with connect_db() as conn:
        result = conn.execute(
            """UPDATE geocoded_locations SET lat = ?, lng = ?, confidence = ?,
               geocoded_at = ?, error = ?, geocode_provider = 'nominatim'
               WHERE normalized_query = ? AND (lat IS NULL OR lng IS NULL)""",
            (lat, lng, confidence, now_ms(), error, query),
        )
        if result.rowcount == 0 and not conn.execute(
            "SELECT 1 FROM geocoded_locations WHERE normalized_query = ?", (query,)
        ).fetchone():
            conn.execute(
                """INSERT INTO geocoded_locations
                   (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at, error)
                   VALUES (?, ?, ?, ?, 'nominatim', ?, ?, ?)""",
                (location, query, lat, lng, confidence, now_ms(), error),
            )


def geocode_pending_summary(limit: int | None = DEFAULT_BATCH_LIMIT,
                            delay_seconds: float = DEFAULT_DELAY_SECONDS,
                            retry_not_found: bool = False,
                            provider_url: str = DEFAULT_PROVIDER_URL,
                            candidate_locations: Iterable[str] | None = None) -> dict[str, int | bool]:
    if limit is not None and limit < 0:
        raise ValueError("limit must be nonnegative")
    if delay_seconds < 0:
        raise ValueError("delay_seconds must be nonnegative")
    candidates, unseen, cached = _location_work(candidate_locations, retry_not_found)
    batch = candidates[:limit] if limit is not None else candidates
    summary: dict[str, int | bool] = {
        "new_unique_locations": unseen, "already_cached": cached,
        "attempted": 0, "success": 0, "not_found": 0,
        "deferred": 0, "remaining": len(candidates), "rate_limited": False,
    }
    for index, (location, query) in enumerate(batch):
        if index:
            time.sleep(delay_seconds)
        try:
            if provider_url == DEFAULT_PROVIDER_URL:
                lat, lng, confidence, error = geocode(query)
            else:
                lat, lng, confidence, error = geocode(query, provider_url=provider_url)
        except Exception as exc:
            lat, lng, confidence, error = None, None, None, str(exc)
        summary["attempted"] += 1
        if lat is not None and lng is not None:
            summary["success"] += 1
            _cache_result(location, query, lat, lng, confidence, None)
        elif error == "not_found":
            summary["not_found"] += 1
            _cache_result(location, query, None, None, None, "not_found")
        else:
            summary["deferred"] += 1
            _cache_result(location, query, None, None, None, error or "transient_error")
        log_import(f"geocoded location={location} query={query} error={error or ''}")
        summary["remaining"] -= 1
        if is_rate_limited(error):
            summary["rate_limited"] = True
            log_import("geocode_rate_limited stop_batch=true")
            break
    summary["remaining"] += summary["deferred"]
    return summary


def geocode_pending(limit: int | None = DEFAULT_BATCH_LIMIT, delay_seconds: float = DEFAULT_DELAY_SECONDS) -> int:
    return int(geocode_pending_summary(limit=limit, delay_seconds=delay_seconds)["attempted"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Geocode only uncached published locations.")
    parser.add_argument("--limit", type=int, default=DEFAULT_BATCH_LIMIT)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parser.add_argument("--provider-url", default=DEFAULT_PROVIDER_URL)
    parser.add_argument("--retry-not-found", action="store_true")
    args = parser.parse_args()
    print(json.dumps(geocode_pending_summary(args.limit, args.delay, args.retry_not_found, args.provider_url)))


if __name__ == "__main__":
    main()
