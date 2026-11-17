from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import announcement_reviews
import import_pdf
import rebuild_all
import refresh_monthly
import seed_initial_data
from export_initial_seed import export_initial_seed
from pdf_parser import ParsedRecord

OFFICIAL = "https://www-ws.gov.taipei/fixture.pdf"
ALIAS = "https://dot.gov.taipei/fixture.pdf"
OLD = "a" * 64
NEW = "b" * 64
RETIRED = "c" * 64


class AnnouncementReviewTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.db = self.root / "review.db"
        self.seed = self.root / "seed.json"
        self.reviews = self.root / "reviews.json"
        self.reviews.write_text("[]", encoding="utf-8")
        self.enterContext(patch.object(announcement_reviews, "REVIEW_PATH", self.reviews))
        self.enterContext(patch.object(seed_initial_data, "SEED_PATH", self.seed))
        for module in (seed_initial_data, import_pdf, refresh_monthly):
            self.enterContext(patch.object(module, "connect_db", side_effect=self.connect))
        self.enterContext(patch.object(import_pdf, "log_import"))
        with self.connect() as conn:
            for migration in sorted((ROOT / "drizzle" / "migrations").glob("*.sql")):
                conn.executescript(migration.read_text(encoding="utf-8"))

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.db)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def write_seed(self, sha256):
        record = {
            "sequenceNo": 1, "name": "Fixture", "violationDate": 11, "lawArticle": None,
            "locationText": "Street", "factText": "Fact", "violationCount": None,
            "violationTypes": [], "alcoholMgPerL": None, "unlicensed": False,
            "hasPhoto": False, "parserConfidence": 1.0, "needsReview": False,
        }
        source = {
            "title": "Fixture", "sourceUrl": "https://dot.gov.taipei/", "pdfUrl": OFFICIAL,
            "publishedDate": 42, "contentHash": sha256, "records": [record],
        }
        self.seed.write_text(json.dumps({"sources": [source]}), encoding="utf-8")

    def read_records(self):
        with self.connect() as conn:
            return [
                tuple(row) for row in conn.execute(
                    "SELECT s.pdf_url, s.content_hash, r.name, r.is_hidden "
                    "FROM offender_records r JOIN sources s ON s.id = r.source_id ORDER BY r.id"
                )
            ]

    def test_hidden_rows_do_not_make_a_database_empty_and_survive_reseed(self):
        self.write_seed(OLD)
        self.assertEqual(seed_initial_data.seed_initial_data(), 1)
        with self.connect() as conn:
            conn.execute("UPDATE offender_records SET is_hidden = 1")
        self.assertEqual(seed_initial_data.seed_initial_data(if_empty=True), 0)
        self.assertEqual(seed_initial_data.seed_initial_data(), 1)
        self.assertEqual(self.read_records(), [(OFFICIAL, OLD, "Fixture", 1)])

    def test_import_preserves_matching_hide_and_keeps_original_on_uncertain_match(self):
        self.write_seed(OLD)
        seed_initial_data.seed_initial_data()
        with self.connect() as conn:
            conn.execute("UPDATE offender_records SET is_hidden = 1")
        record = ParsedRecord("99", "Fixture", 11, None, None, None, None, [], None, False, False, 1.0, False)
        with patch.object(import_pdf, "download_pdf", return_value=(self.root / "test.pdf", NEW)), patch.object(
            import_pdf, "records_from_pdf", return_value=[record]
        ):
            self.assertEqual(import_pdf.import_pdf(OFFICIAL, None), 1)
            self.assertEqual(self.read_records(), [(OFFICIAL, NEW, "Fixture", 1)])
            record.name = "Unmatched"
            with self.assertRaisesRegex(ValueError, "hidden record"):
                import_pdf.import_pdf(OFFICIAL, None)
        self.assertEqual(self.read_records(), [(OFFICIAL, NEW, "Fixture", 1)])

    def test_import_deduplicates_empty_discovery_of_existing_pdf(self):
        self.write_seed(OLD)
        seed_initial_data.seed_initial_data()
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO sources(title, source_url, pdf_url, parse_status) VALUES (?, ?, ?, 'discovered')",
                ("Duplicate", ALIAS, ALIAS),
            )
            conn.execute("UPDATE offender_records SET is_hidden = 1")
        record = ParsedRecord("1", "Fixture", 11, None, None, None, None, [], None, False, False, 1.0, False)
        with patch.object(import_pdf, "download_pdf", return_value=(self.root / "test.pdf", OLD)), patch.object(
            import_pdf, "records_from_pdf", return_value=[record]
        ):
            self.assertEqual(import_pdf.import_pdf(ALIAS, None), 1)
        self.assertEqual(self.read_records(), [(OFFICIAL, OLD, "Fixture", 1)])
        with self.connect() as conn:
            self.assertIsNone(conn.execute("SELECT 1 FROM sources WHERE pdf_url = ?", (ALIAS,)).fetchone())

    def test_withdrawal_removes_persisted_alias_and_blocks_reimport(self):
        self.write_seed(OLD)
        seed_initial_data.seed_initial_data()
        with self.connect() as conn:
            conn.execute("UPDATE sources SET pdf_url = ?", (ALIAS,))
        self.reviews.write_text(json.dumps([{"action": "withdraw", "pdfUrl": OFFICIAL, "sha256": OLD}]))
        self.assertEqual(seed_initial_data.seed_initial_data(if_empty=True), 0)
        self.assertEqual(self.read_records(), [])
        with patch.object(import_pdf, "download_pdf") as download:
            with self.assertRaisesRegex(ValueError, "withdrawn"):
                import_pdf.import_pdf(OFFICIAL, None)
            download.assert_not_called()
            download.return_value = (self.root / "test.pdf", OLD)
            with self.assertRaisesRegex(ValueError, "reviewed"):
                import_pdf.import_pdf(ALIAS, None)

    def test_review_only_exports_verified_replacement_without_crawl(self):
        self.write_seed(OLD)
        self.reviews.write_text(json.dumps(
            [{"action": "replace", "pdfUrl": OFFICIAL, "previousSha256": OLD, "sha256": NEW}]
        ))
        self.assertEqual(seed_initial_data.seed_initial_data(for_refresh=True), 1)
        record = ParsedRecord("1", "Corrected", 22, None, None, None, None, [], None, False, False, 1.0, False)
        with patch.object(import_pdf, "download_pdf", return_value=(self.root / "test.pdf", OLD)), patch.object(
            import_pdf, "records_from_pdf", return_value=[record]
        ) as parse, patch.object(refresh_monthly, "crawl") as crawl, patch.object(
            refresh_monthly, "export_initial_seed", side_effect=lambda _: export_initial_seed(self.db, self.seed)
        ):
            with self.assertRaisesRegex(ValueError, "reviewed"):
                refresh_monthly.refresh_monthly(review_only=True)
            parse.assert_not_called()
            self.assertEqual(self.read_records(), [(OFFICIAL, OLD, "Fixture", 0)])
            with patch.object(import_pdf, "download_pdf", return_value=(self.root / "test.pdf", NEW)):
                result = refresh_monthly.refresh_monthly(review_only=True)
            crawl.assert_not_called()
        self.assertEqual(result["reviewed_replacements"], 1)
        self.assertEqual(self.read_records(), [(OFFICIAL, NEW, "Corrected", 0)])
        self.assertEqual(json.loads(self.seed.read_text(encoding="utf-8"))["sources"][0]["contentHash"], NEW)

    def test_startup_replaces_stale_alias_and_retains_its_hides(self):
        self.write_seed(RETIRED)
        seed_initial_data.seed_initial_data()
        with self.connect() as conn:
            conn.execute("UPDATE sources SET pdf_url = ?", (ALIAS,))
            conn.execute("UPDATE offender_records SET is_hidden = 1")
        self.write_seed(NEW)
        seed_initial_data.seed_initial_data()
        self.reviews.write_text(json.dumps(
            [{"action": "replace", "pdfUrl": OFFICIAL, "previousSha256": OLD, "sha256": NEW,
              "retiredSha256": [RETIRED]}]
        ))
        self.assertEqual(seed_initial_data.seed_initial_data(if_empty=True), 1)
        self.assertEqual(self.read_records(), [(OFFICIAL, NEW, "Fixture", 1)])
        self.assertEqual(seed_initial_data.seed_initial_data(if_empty=True), 0)
        with patch.object(import_pdf, "copy_pdf", return_value=(self.root / "test.pdf", RETIRED)):
            with self.assertRaisesRegex(ValueError, "reviewed"):
                import_pdf.import_pdf(None, "reviewed.pdf")

    def test_rebuild_uses_cached_digest_for_legacy_upload(self):
        self.write_seed(OLD)
        seed_initial_data.seed_initial_data()
        with self.connect() as conn:
            conn.execute("UPDATE sources SET pdf_url = 'file:///previous-upload.pdf'")
        cache_dir = self.root / "pdfs"
        cache_dir.mkdir()
        cached_pdf = cache_dir / f"{OLD}.pdf"
        cached_pdf.touch()
        with patch.object(rebuild_all, "connect_db", side_effect=self.connect), patch.object(
            rebuild_all, "DATA_DIR", self.root
        ), patch.object(rebuild_all, "crawl", return_value=0), patch.object(rebuild_all, "log_import"), patch.object(
            rebuild_all, "geocode_pending"
        ), patch.object(rebuild_all, "import_pdf") as reimport:
            rebuild_all.rebuild()
        reimport.assert_called_once_with(None, str(cached_pdf), "Fixture", expected_sha256=OLD)


if __name__ == "__main__":
    unittest.main()
