import sys
import unittest
import unittest.mock
import sqlite3
import tempfile
import urllib.parse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import crawl_sources
import geocode_locations
import seed_initial_data
import seed_geocode_cache
import export_geocode_cache
from common import content_hash, normalize_space, parse_taiwan_date
from crawl_sources import extract_pdf_links
from geocode_locations import geocode, geocode_pending, is_rate_limited, normalized_query, pending_locations
from pdf_parser import parse_alcohol_mg_per_l, parse_violation_count, parse_violation_types, records_from_rows, rows_from_table, rows_from_text


class IngestionTests(unittest.TestCase):
    def test_crawler_extracts_pdf_links_from_pages(self):
        html = """
        <html><body>
          <a href="/Download.ashx?u=/file.pdf&n=115.05.23公告.pdf">115.05.23臺北市第9次酒駕累犯公布名單.pdf</a>
        </body></html>
        """
        links = extract_pdf_links(html, "https://dot.gov.taipei/News.aspx?page=1")
        self.assertEqual(len(links), 1)
        self.assertIn("Download.ashx", links[0].pdf_url)
        self.assertEqual(links[0].title, "115.05.23臺北市第9次酒駕累犯公布名單.pdf")
        self.assertIsNotNone(links[0].published_date)

    def test_crawler_uses_page_fallback_date_and_ignores_non_pdf_links(self):
        html = """
        <html><body>
          <span>發布日期：115年5月23日</span>
          <a href="/News_Content.aspx?id=1">一般頁面</a>
          <a href="Download.ashx?u=/file&n=list.pdf"></a>
        </body></html>
        """
        links = extract_pdf_links(html, "https://dot.gov.taipei/News.aspx?page=2")
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].title, "Taipei DOT PDF announcement")
        self.assertEqual(links[0].published_date, parse_taiwan_date("115.05.23"))

    def test_crawl_stops_when_page_has_no_new_pdf_links(self):
        html_with_pdf = '<a href="/Download.ashx?u=/a.pdf&n=115.05.23.pdf">115.05.23.pdf</a>'
        with unittest.mock.patch.object(crawl_sources, "fetch_html", side_effect=[html_with_pdf, html_with_pdf]), unittest.mock.patch.object(
            crawl_sources, "upsert_sources", return_value=1
        ) as upsert, unittest.mock.patch.object(crawl_sources.time, "sleep"):
            inserted = crawl_sources.crawl(page_size=20, delay_seconds=0, max_pages=5)
        self.assertEqual(inserted, 1)
        self.assertEqual(upsert.call_count, 1)

    def test_parser_extracts_expected_columns_from_rows(self):
        records = records_from_rows(
            [
                {
                    "序號": "1",
                    "姓名": "王小明",
                    "違規日": "115.05.23",
                    "違規條款": "道路交通管理處罰條例",
                    "違規地點": "忠孝東路一段",
                    "違規事實": "酒駕第2次，酒精濃度0.20mg/L",
                }
            ]
        )
        self.assertEqual(records[0].name, "王小明")
        self.assertEqual(records[0].violation_count, 2)
        self.assertIn("酒駕", records[0].violation_types)
        self.assertEqual(records[0].alcohol_mg_per_l, 0.20)
        self.assertFalse(records[0].needs_review)

    def test_table_parser_skips_title_rows_before_header(self):
        rows = rows_from_table(
            [
                ["115.05.27臺北市酒駕及拒測累犯公布名單", None, None, None, None, None, None],
                ["序號", "照片", "姓名", "違規日", "違規條款", "違規地點", "違規事實"],
                ["1", "", "翁澤民", "114/6/6", "第35條第3\n項", "環河南路二段", "第3次以上\n(酒駕)（0.20mg/L）"],
            ]
        )
        self.assertEqual(rows[0]["序號"], "1")
        self.assertEqual(rows[0]["姓名"], "翁澤民")
        self.assertEqual(rows[0]["違規條款"], "第35條第3 項")

    def test_text_fallback_detects_sequence_rows(self):
        rows = rows_from_text("1 王小明 115.05.23 忠孝東路一段 酒駕第2次\n2 李小美 115.05.24 南京東路三段 拒測第3次以上")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]["序號"], "2")

    def test_violation_count_parser(self):
        self.assertEqual(parse_violation_count("第2次"), 2)
        self.assertEqual(parse_violation_count("第3次以上"), 3)
        self.assertEqual(parse_violation_count("第4次"), 4)
        self.assertEqual(parse_violation_count("第5次"), 5)

    def test_violation_type_parser(self):
        self.assertIn("酒駕", parse_violation_types("酒駕"))
        self.assertIn("毒駕/藥駕", parse_violation_types("藥駕"))
        self.assertIn("毒駕/藥駕", parse_violation_types("吸食毒品"))
        self.assertIn("拒測", parse_violation_types("拒測"))
        self.assertIn("無照", parse_violation_types("無照"))

    def test_alcohol_parser(self):
        self.assertEqual(parse_alcohol_mg_per_l("酒精濃度0.20mg/L"), 0.20)

    def test_common_helpers_normalize_dates_hashes_and_spaces(self):
        self.assertEqual(parse_taiwan_date("115年5月23日"), parse_taiwan_date("115.05.23"))
        self.assertEqual(parse_taiwan_date("2026-05-23"), parse_taiwan_date("115.05.23"))
        self.assertIsNone(parse_taiwan_date("115.99.99"))
        self.assertEqual(normalize_space("  A\n\tB  "), "A B")
        self.assertEqual(content_hash(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")

    def test_geocoder_query_uses_only_location_text(self):
        query = normalized_query("忠孝東路一段")
        self.assertEqual(query, "臺北市 忠孝東路一段")
        self.assertNotIn("王小明", query)
        self.assertNotIn("第2次", query)

    def test_geocoder_keeps_existing_taipei_prefix(self):
        self.assertEqual(normalized_query("臺北市 信義路五段"), "臺北市 信義路五段")
        self.assertEqual(normalized_query("台北市 信義路五段"), "台北市 信義路五段")

    def test_geocoder_parses_success_and_not_found_without_person_data(self):
        class FakeResponse:
            def __init__(self, payload):
                self.payload = payload

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return self.payload

        def fake_urlopen(request, timeout):
            self.assertEqual(timeout, 30)
            parsed = urllib.parse.urlparse(request.full_url)
            query = urllib.parse.parse_qs(parsed.query)
            self.assertEqual(query["q"], ["臺北市 忠孝東路一段"])
            self.assertNotIn("王小明", request.full_url)
            return FakeResponse(b'[{"lat": "25.1", "lon": "121.5", "importance": 0.75}]')

        with unittest.mock.patch.object(geocode_locations.urllib.request, "urlopen", side_effect=fake_urlopen):
            self.assertEqual(geocode("臺北市 忠孝東路一段"), (25.1, 121.5, 0.75, None))

        with unittest.mock.patch.object(geocode_locations.urllib.request, "urlopen", return_value=FakeResponse(b"[]")):
            self.assertEqual(geocode("臺北市 不存在路段"), (None, None, None, "not_found"))

    def test_geocoder_processes_only_cached_pending_locations(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "geocode.db"
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.executescript(
                """
                CREATE TABLE offender_records (location_text TEXT);
                CREATE TABLE geocoded_locations (
                  location_text TEXT,
                  normalized_query TEXT,
                  lat REAL,
                  lng REAL,
                  geocode_provider TEXT,
                  confidence REAL,
                  geocoded_at INTEGER,
                  error TEXT
                );
                INSERT INTO offender_records VALUES ('忠孝東路一段');
                INSERT INTO offender_records VALUES ('忠孝東路一段');
                INSERT INTO offender_records VALUES ('南京東路三段');
                INSERT INTO geocoded_locations VALUES ('南京東路三段', '臺北市 南京東路三段', 25.0, 121.5, 'nominatim', 0.8, 1, NULL);
                """
            )
            conn.commit()
            conn.close()

            def connect_test_db():
                test_conn = sqlite3.connect(db_path)
                test_conn.row_factory = sqlite3.Row
                return test_conn

            with unittest.mock.patch.object(geocode_locations, "connect_db", side_effect=connect_test_db), unittest.mock.patch.object(
                geocode_locations, "geocode", return_value=(25.1, 121.6, 0.9, None)
            ) as geocode_mock, unittest.mock.patch.object(geocode_locations, "now_ms", return_value=123), unittest.mock.patch.object(
                geocode_locations.time, "sleep"
            ), unittest.mock.patch.object(geocode_locations, "log_import"):
                self.assertEqual(pending_locations(), ["忠孝東路一段"])
                self.assertEqual(geocode_pending(delay_seconds=0), 1)

            geocode_mock.assert_called_once_with("臺北市 忠孝東路一段")
            with sqlite3.connect(db_path) as verify:
                rows = verify.execute("SELECT location_text, normalized_query, lat, lng FROM geocoded_locations ORDER BY location_text").fetchall()
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0][0], "南京東路三段")
            self.assertEqual(rows[1][0], "忠孝東路一段")

    def test_geocoder_retries_rate_limit_errors_but_skips_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "geocode_retry.db"
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.executescript(
                """
                CREATE TABLE offender_records (location_text TEXT);
                CREATE TABLE geocoded_locations (
                  location_text TEXT,
                  normalized_query TEXT,
                  lat REAL,
                  lng REAL,
                  geocode_provider TEXT,
                  confidence REAL,
                  geocoded_at INTEGER,
                  error TEXT
                );
                INSERT INTO offender_records VALUES ('中央北路三段');
                INSERT INTO offender_records VALUES ('不存在路段');
                INSERT INTO geocoded_locations VALUES ('中央北路三段', '臺北市 中央北路三段', NULL, NULL, 'nominatim', NULL, 1, 'HTTP Error 429: Too many requests');
                INSERT INTO geocoded_locations VALUES ('不存在路段', '臺北市 不存在路段', NULL, NULL, 'nominatim', NULL, 1, 'not_found');
                """
            )
            conn.commit()
            conn.close()

            def connect_test_db():
                test_conn = sqlite3.connect(db_path)
                test_conn.row_factory = sqlite3.Row
                return test_conn

            with unittest.mock.patch.object(geocode_locations, "connect_db", side_effect=connect_test_db):
                self.assertEqual(pending_locations(), ["中央北路三段"])

    def test_geocoder_stops_batch_after_rate_limit(self):
        self.assertTrue(is_rate_limited("HTTP Error 429: Too many requests"))
        self.assertFalse(is_rate_limited("not_found"))
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "geocode_stop.db"
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.executescript(
                """
                CREATE TABLE offender_records (location_text TEXT);
                CREATE TABLE geocoded_locations (
                  location_text TEXT,
                  normalized_query TEXT,
                  lat REAL,
                  lng REAL,
                  geocode_provider TEXT,
                  confidence REAL,
                  geocoded_at INTEGER,
                  error TEXT
                );
                INSERT INTO offender_records VALUES ('中央北路三段');
                INSERT INTO offender_records VALUES ('中正路');
                """
            )
            conn.commit()
            conn.close()

            def connect_test_db():
                test_conn = sqlite3.connect(db_path)
                test_conn.row_factory = sqlite3.Row
                return test_conn

            with unittest.mock.patch.object(geocode_locations, "connect_db", side_effect=connect_test_db), unittest.mock.patch.object(
                geocode_locations, "geocode", return_value=(None, None, None, "HTTP Error 429: Too many requests")
            ) as geocode_mock, unittest.mock.patch.object(geocode_locations, "now_ms", return_value=456), unittest.mock.patch.object(
                geocode_locations.time, "sleep"
            ) as sleep_mock, unittest.mock.patch.object(geocode_locations, "log_import"):
                self.assertEqual(geocode_pending(delay_seconds=0), 1)

            geocode_mock.assert_called_once()
            sleep_mock.assert_not_called()

    def test_initial_seed_inserts_public_pdf_records_without_photos(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "seed.db"
            conn = sqlite3.connect(db_path)
            migrations_dir = ROOT / "drizzle" / "migrations"
            for migration in sorted(migrations_dir.glob("*.sql")):
                conn.executescript(migration.read_text(encoding="utf-8"))
            conn.close()

            def connect_test_db():
                test_conn = sqlite3.connect(db_path)
                test_conn.row_factory = sqlite3.Row
                return test_conn

            with unittest.mock.patch.object(seed_initial_data, "connect_db", side_effect=connect_test_db):
                self.assertEqual(seed_initial_data.seed_initial_data(), 395)
                self.assertEqual(seed_initial_data.seed_initial_data(if_empty=True), 0)
                self.assertEqual(seed_initial_data.seed_initial_data(), 395)

            with unittest.mock.patch.object(seed_geocode_cache, "connect_db", side_effect=connect_test_db):
                self.assertEqual(seed_geocode_cache.seed_geocode_cache(), 32)

            with sqlite3.connect(db_path) as verify:
                source_count = verify.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
                record_count = verify.execute("SELECT COUNT(*) FROM offender_records").fetchone()[0]
                geocode_count = verify.execute("SELECT COUNT(*) FROM geocoded_locations").fetchone()[0]
                photo_count = verify.execute("SELECT COUNT(*) FROM offender_records WHERE has_photo = 1").fetchone()[0]
                needs_review_count = verify.execute("SELECT COUNT(*) FROM offender_records WHERE needs_review = 1").fetchone()[0]
            self.assertEqual(source_count, 13)
            self.assertEqual(record_count, 395)
            self.assertEqual(geocode_count, 32)
            self.assertEqual(photo_count, 0)
            self.assertEqual(needs_review_count, 0)

    def test_demo_geocode_seed_covers_initial_record_locations(self):
        initial_seed = json.loads((ROOT / "data" / "seed" / "initial_announcements.json").read_text(encoding="utf-8"))
        geocode_seed = json.loads((ROOT / "data" / "seed" / "geocoded_locations.json").read_text(encoding="utf-8"))
        record_locations = {
            record["locationText"]
            for source in initial_seed["sources"]
            for record in source["records"]
        }
        geocoded_locations = {location["locationText"] for location in geocode_seed["locations"]}
        self.assertTrue(geocoded_locations)
        self.assertTrue(geocoded_locations.issubset(record_locations))
        self.assertTrue(all(location["geocodeProvider"] == "local-demo-seed" for location in geocode_seed["locations"]))
        self.assertTrue(all(location["lat"] is not None and location["lng"] is not None for location in geocode_seed["locations"]))

    def test_geocode_cache_export_and_seed_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            source_db = Path(tmp) / "source.db"
            target_db = Path(tmp) / "target.db"
            export_path = Path(tmp) / "geocoded_locations.json"
            schema = """
                CREATE TABLE geocoded_locations (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  location_text TEXT NOT NULL,
                  normalized_query TEXT NOT NULL UNIQUE,
                  lat REAL,
                  lng REAL,
                  geocode_provider TEXT NOT NULL DEFAULT 'nominatim',
                  confidence REAL,
                  geocoded_at INTEGER,
                  error TEXT,
                  created_at INTEGER DEFAULT 0,
                  updated_at INTEGER DEFAULT 0
                );
            """
            for db_path in (source_db, target_db):
                conn = sqlite3.connect(db_path)
                conn.executescript(schema)
                conn.close()

            source = sqlite3.connect(source_db)
            source.execute(
                """
                INSERT INTO geocoded_locations
                    (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at, error)
                VALUES
                    ('中央北路三段', '臺北市 中央北路三段', 25.13, 121.49, 'nominatim', 0.8, 111, NULL),
                    ('中正路', '臺北市 中正路', NULL, NULL, 'nominatim', NULL, 112, 'HTTP Error 429: Too many requests')
                """
            )
            source.commit()
            source.close()

            def connect_source_db():
                conn = sqlite3.connect(source_db)
                conn.row_factory = sqlite3.Row
                return conn

            def connect_target_db():
                conn = sqlite3.connect(target_db)
                conn.row_factory = sqlite3.Row
                return conn

            with unittest.mock.patch.object(export_geocode_cache, "connect_db", side_effect=connect_source_db), unittest.mock.patch.object(
                export_geocode_cache, "now_ms", return_value=999
            ):
                self.assertEqual(export_geocode_cache.export_geocode_cache(export_path), 1)

            with unittest.mock.patch.object(seed_geocode_cache, "connect_db", side_effect=connect_target_db):
                self.assertEqual(seed_geocode_cache.seed_geocode_cache(export_path), 1)

            with sqlite3.connect(target_db) as verify:
                rows = verify.execute("SELECT location_text, normalized_query, lat, lng, error FROM geocoded_locations").fetchall()
            self.assertEqual(rows, [("中央北路三段", "臺北市 中央北路三段", 25.13, 121.49, None)])


if __name__ == "__main__":
    unittest.main()
