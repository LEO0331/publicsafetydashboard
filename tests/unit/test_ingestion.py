import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from crawl_sources import extract_pdf_links
from geocode_locations import normalized_query
from parser import parse_alcohol_mg_per_l, parse_violation_count, parse_violation_types, records_from_rows, rows_from_text


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

    def test_geocoder_query_uses_only_location_text(self):
        query = normalized_query("忠孝東路一段")
        self.assertEqual(query, "臺北市 忠孝東路一段")
        self.assertNotIn("王小明", query)
        self.assertNotIn("第2次", query)


if __name__ == "__main__":
    unittest.main()
