import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import crawl_sources


class AnnouncementTitleTests(unittest.TestCase):
    def test_future_roc_years_and_punctuation_variants(self):
        eligible = (
            "115.09.23臺北市酒駕及拒測累犯公布名單",
            "115.04.22臺北市酒(毒)駕及拒測累犯公布名單",
            "116.01.20臺北市酒駕及拒測累犯公布名單",
            "116.03.18臺北市酒(毒)駕及拒測累犯公布名單",
            "117.12.18臺北市酒（毒）駕及拒測累犯公布名單",
            "118年1月8日 臺北市 酒（毒）駕、及拒測累犯公布名單.pdf",
            "119/2/9 台北市酒(毒)及拒測駕累犯公布名單",
        )
        for title in eligible:
            with self.subTest(title=title):
                self.assertTrue(crawl_sources.is_regular_repeat_offender_announcement(title))

    def test_rejects_separate_series_invalid_dates_and_unrelated_titles(self):
        ineligible = (
            "116.08臺北市酒(毒)駕及拒測累犯三次以上且設籍本市者公告名單",
            "116.08.20臺北市酒(毒)駕及拒測累犯三次以上且設籍本市者公布名單",
            "117.13.18臺北市酒駕及拒測累犯公布名單",
            "116.02.30臺北市酒駕及拒測累犯公布名單",
            "116.03.18臺北市拒測累犯公布名單",
            "116.03.18臺北市酒毒駕累犯公布名單",
            "116.03.18臺北市酒駕專案累犯公布名單",
            "116.03.18新北市酒駕及拒測累犯公布名單",
            "116.03.18臺北市酒駕及拒測累犯公告名單",
            "臺北市酒駕及拒測累犯公布名單",
        )
        for title in ineligible:
            with self.subTest(title=title):
                self.assertFalse(crawl_sources.is_regular_repeat_offender_announcement(title))

    def test_all_bundled_regular_announcement_titles_remain_eligible(self):
        seed = json.loads((ROOT / "data" / "seed" / "initial_announcements.json").read_text(encoding="utf-8"))
        for source in seed["sources"]:
            with self.subTest(title=source["title"]):
                self.assertTrue(crawl_sources.is_regular_repeat_offender_announcement(source["title"]))

    def test_crawler_skips_unrelated_pdf_without_stopping_pagination(self):
        pages = (
            '<a href="/other.pdf">116.08臺北市酒(毒)駕及拒測累犯三次以上且設籍本市者公告名單</a>',
            '<a href="/regular.pdf">117.12.18臺北市酒（毒）駕及拒測累犯公布名單</a>',
        )
        with patch.object(crawl_sources, "fetch_html", side_effect=pages), patch.object(
            crawl_sources, "upsert_sources", return_value=1
        ) as upsert, patch.object(crawl_sources.time, "sleep"):
            self.assertEqual(crawl_sources.crawl(max_pages=2, delay_seconds=0), 1)
        upsert.assert_called_once()
        self.assertEqual([link.title for link in upsert.call_args.args[0]], ["117.12.18臺北市酒（毒）駕及拒測累犯公布名單"])


if __name__ == "__main__":
    unittest.main()
