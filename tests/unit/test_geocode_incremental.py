import json
import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import export_geocode_cache
import geocode_locations
import seed_geocode_cache


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, traceback):
        try:
            return super().__exit__(exc_type, exc, traceback)
        finally:
            self.close()


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.payload


class IncrementalGeocodeTests(unittest.TestCase):
    def setUp(self):
        self.db_path = ROOT / ".tmp-test" / f"geocode-{uuid4().hex}.db"
        self.db_path.parent.mkdir(exist_ok=True)
        with sqlite3.connect(self.db_path, factory=ClosingConnection) as conn:
            conn.executescript("""
                CREATE TABLE offender_records (location_text TEXT);
                CREATE TABLE geocoded_locations (
                  location_text TEXT NOT NULL,
                  normalized_query TEXT NOT NULL UNIQUE,
                  lat REAL, lng REAL, geocode_provider TEXT,
                  confidence REAL, geocoded_at INTEGER, error TEXT,
                  updated_at INTEGER DEFAULT 0
                );
            """)
        self.patches = [
            patch.object(geocode_locations, "connect_db", self.connect),
            patch.object(export_geocode_cache, "connect_db", self.connect),
            patch.object(seed_geocode_cache, "connect_db", self.connect),
            patch.object(geocode_locations, "log_import"),
            patch.object(geocode_locations, "now_ms", return_value=123),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.db_path.unlink(missing_ok=True)

    def connect(self):
        conn = sqlite3.connect(self.db_path, factory=ClosingConnection)
        conn.row_factory = sqlite3.Row
        return conn

    def records(self, *locations):
        with self.connect() as conn:
            conn.executemany("INSERT INTO offender_records VALUES (?)", [(x,) for x in locations])

    def cache(self, location, lat, lng, error=None):
        with self.connect() as conn:
            conn.execute("""INSERT INTO geocoded_locations
                (location_text, normalized_query, lat, lng, geocode_provider, geocoded_at, error)
                VALUES (?, ?, ?, ?, 'nominatim', 1, ?)""",
                (location, geocode_locations.normalized_query(location), lat, lng, error))

    def test_cached_and_duplicate_locations_make_one_request_and_second_run_none(self):
        self.records("忠孝東路一段", "忠孝東路一段", "南京東路三段")
        self.cache("南京東路三段", 25.0, 121.5)
        with patch.object(geocode_locations.urllib.request, "urlopen", return_value=FakeResponse(
            [{"lat": "25.1", "lon": "121.6", "importance": 0.7}]
        )) as http, patch.object(geocode_locations.time, "sleep") as sleep:
            summary = geocode_locations.geocode_pending_summary(delay_seconds=0)
            self.assertEqual((summary["success"], summary["already_cached"], summary["remaining"]), (1, 1, 0))
            self.assertEqual(http.call_count, 1)
            sleep.assert_not_called()
            self.assertEqual(geocode_locations.geocode_pending_summary(delay_seconds=0)["attempted"], 0)
            self.assertEqual(http.call_count, 1)
        with self.connect() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM geocoded_locations").fetchone()[0], 2)

    def test_batch_is_bounded_and_requests_are_sequential_with_configured_provider(self):
        self.records("甲路", "乙路", "丙路")
        with patch.object(geocode_locations.urllib.request, "urlopen", return_value=FakeResponse([])) as http, \
             patch.object(geocode_locations.time, "sleep") as sleep:
            summary = geocode_locations.geocode_pending_summary(limit=2, delay_seconds=16, provider_url="https://example.test/search")
        self.assertEqual((summary["attempted"], summary["not_found"], summary["remaining"]), (2, 2, 1))
        self.assertEqual(http.call_count, 2)
        sleep.assert_called_once_with(16)
        self.assertTrue(all(call.args[0].full_url.startswith("https://example.test/search?") for call in http.call_args_list))

    def test_not_found_is_permanent_and_export_is_deterministic(self):
        self.records("不存在路段")
        output = self.db_path.with_suffix(".json")
        try:
            with patch.object(geocode_locations.urllib.request, "urlopen", return_value=FakeResponse([])) as http:
                self.assertEqual(geocode_locations.geocode_pending_summary(delay_seconds=0)["not_found"], 1)
                self.assertEqual(geocode_locations.geocode_pending_summary(delay_seconds=0)["attempted"], 0)
                self.assertEqual(http.call_count, 1)
            self.assertEqual(export_geocode_cache.export_geocode_cache(output), 1)
            first = output.read_bytes()
            self.assertEqual(export_geocode_cache.export_geocode_cache(output), 1)
            self.assertEqual(output.read_bytes(), first)
            self.assertEqual(json.loads(first)["locations"][0]["error"], "not_found")
            with self.connect() as conn:
                row = conn.execute("SELECT lat, lng FROM geocoded_locations").fetchone()
                self.assertEqual(tuple(row), (None, None))
        finally:
            output.unlink(missing_ok=True)

    def test_transient_failure_stays_pending_and_429_preserves_earlier_success(self):
        self.records("甲路", "乙路", "丙路")
        responses = [FakeResponse([{"lat": "25", "lon": "121"}]), RuntimeError("HTTP Error 429"), FakeResponse([])]
        def respond(*_args, **_kwargs):
            result = responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result
        with patch.object(geocode_locations.urllib.request, "urlopen", side_effect=respond) as http, \
             patch.object(geocode_locations.time, "sleep"):
            summary = geocode_locations.geocode_pending_summary(delay_seconds=0)
        self.assertEqual((summary["success"], summary["deferred"], summary["remaining"]), (1, 1, 2))
        self.assertTrue(summary["rate_limited"])
        self.assertEqual(http.call_count, 2)
        with self.connect() as conn:
            rows = conn.execute("SELECT location_text, lat FROM geocoded_locations ORDER BY location_text").fetchall()
            self.assertEqual([(x[0], x[1]) for x in rows], [("丙路", 25.0), ("乙路", None)])
        self.assertEqual(geocode_locations.pending_locations(), ["乙路", "甲路"])

    def test_candidate_scope_excludes_historical_pending_locations(self):
        self.records("舊路", "新路")
        self.assertEqual(geocode_locations.pending_locations(candidate_locations=["新路"]), ["新路"])
        with patch.object(geocode_locations.urllib.request, "urlopen", return_value=FakeResponse([])) as http:
            summary = geocode_locations.geocode_pending_summary(candidate_locations=["新路"], delay_seconds=0)
        self.assertEqual((summary["new_unique_locations"], summary["attempted"]), (1, 1))
        self.assertEqual(http.call_count, 1)


if __name__ == "__main__":
    unittest.main()
