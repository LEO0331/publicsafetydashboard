from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import ROOT, connect_db, now_ms

DEFAULT_OUTPUT = ROOT / "data" / "seed" / "geocoded_locations.json"


def export_geocode_cache(output_path: Path = DEFAULT_OUTPUT) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with connect_db() as conn:
        rows = conn.execute(
            """
            SELECT location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at
            FROM geocoded_locations
            WHERE lat IS NOT NULL AND lng IS NOT NULL
            ORDER BY location_text
            """
        ).fetchall()
    payload = {
        "exportedAt": now_ms(),
        "locations": [
            {
                "locationText": row["location_text"],
                "normalizedQuery": row["normalized_query"],
                "lat": row["lat"],
                "lng": row["lng"],
                "geocodeProvider": row["geocode_provider"],
                "confidence": row["confidence"],
                "geocodedAt": row["geocoded_at"],
            }
            for row in rows
        ],
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export successful geocode cache rows to a deployable JSON seed.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    count = export_geocode_cache(args.output)
    print(f"Exported {count} geocoded locations to {args.output}")


if __name__ == "__main__":
    main()
