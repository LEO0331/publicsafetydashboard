from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from common import ROOT, connect_db, now_ms

DEFAULT_SEED_PATH = ROOT / "data" / "seed" / "geocoded_locations.json"


def load_locations(seed_path: Path) -> list[dict[str, Any]]:
    if not seed_path.exists():
        return []
    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return payload.get("locations", [])


def seed_geocode_cache(seed_path: Path = DEFAULT_SEED_PATH) -> int:
    locations = load_locations(seed_path)
    if not locations:
        return 0

    written = 0
    with connect_db() as conn:
        for item in locations:
            lat = item.get("lat")
            lng = item.get("lng")
            if lat is None or lng is None:
                continue
            conn.execute(
                """
                INSERT INTO geocoded_locations
                    (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at, error, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
                ON CONFLICT(normalized_query) DO UPDATE SET
                    location_text = excluded.location_text,
                    lat = excluded.lat,
                    lng = excluded.lng,
                    geocode_provider = excluded.geocode_provider,
                    confidence = excluded.confidence,
                    geocoded_at = excluded.geocoded_at,
                    error = NULL,
                    updated_at = excluded.updated_at
                """,
                (
                    item["locationText"],
                    item["normalizedQuery"],
                    lat,
                    lng,
                    item.get("geocodeProvider") or "nominatim-local-seed",
                    item.get("confidence"),
                    item.get("geocodedAt") or now_ms(),
                    now_ms(),
                ),
            )
            written += 1
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed cached geocode rows from a JSON file.")
    parser.add_argument("--file", type=Path, default=DEFAULT_SEED_PATH)
    args = parser.parse_args()
    count = seed_geocode_cache(args.file)
    print(f"Seeded {count} geocoded locations")


if __name__ == "__main__":
    main()
