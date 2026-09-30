import sqlite3
import sys
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import refresh_monthly


class MonthlyRefreshTests(unittest.TestCase):
    def test_geocoder_outage_does_not_discard_valid_announcement(self):
        temp_root = ROOT / ".tmp-test"
        temp_root.mkdir(exist_ok=True)
        db_path = temp_root / f"monthly-{uuid.uuid4().hex}.db"
        try:
            conn = sqlite3.connect(db_path)
            try:
                for migration in sorted((ROOT / "drizzle" / "migrations").glob("*.sql")):
                    conn.executescript(migration.read_text(encoding="utf-8"))
            finally:
                conn.close()

            @contextmanager
            def connect_test_db():
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                try:
                    with conn:
                        yield conn
                finally:
                    conn.close()

            def fake_crawl(**kwargs):
                with connect_test_db() as conn:
                    conn.execute(
                        "INSERT INTO sources(title, source_url, pdf_url, published_date, parse_status) "
                        "VALUES (?, ?, ?, ?, 'discovered')",
                        ("116.01.20臺北市酒駕及拒測累犯公布名單", "listing", "pdf", 1790000000000),
                    )
                return 1

            def fake_import(url, file_path, title):
                with connect_test_db() as conn:
                    conn.execute(
                        "UPDATE sources SET parse_status='parsed', content_hash='digest' WHERE pdf_url=?",
                        (url,),
                    )
                    conn.execute(
                        "INSERT INTO offender_records(source_id, location_text, fact_text) "
                        "SELECT id, '忠孝東路', 'public fact' FROM sources WHERE pdf_url=?",
                        (url,),
                    )
                return 1

            with patch.object(refresh_monthly, "connect_db", side_effect=connect_test_db), patch.object(
                refresh_monthly, "crawl", side_effect=fake_crawl
            ), patch.object(refresh_monthly, "import_pdf", side_effect=fake_import), patch.object(
                refresh_monthly, "export_initial_seed", return_value=(1, 1)
            ) as seed_export, patch.object(
                refresh_monthly, "geocode_pending_summary", side_effect=TimeoutError("provider timeout")
            ), patch.object(refresh_monthly, "export_geocode_cache"):
                result = refresh_monthly.refresh_monthly(geocode_delay=0)

            seed_export.assert_called_once()
            self.assertEqual(result["new_announcements"], 1)
            self.assertEqual(result["new_parsed_records"], 1)
            self.assertEqual(result["total_records"], 1)
            self.assertEqual(result["new_unique_locations"], 1)
            self.assertEqual(result["unmapped_locations"], 1)
            self.assertIn("provider timeout", result["geocode_error"])
        finally:
            db_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
