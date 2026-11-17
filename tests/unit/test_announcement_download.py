import io
import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from announcement_download import LISTING_HOSTS, PDF_HOSTS, fetch_announcement, read_bounded, validate_announcement_url


LISTING_URL = "https://dot.gov.taipei/News.aspx"
PDF_URL = "https://www-ws.gov.taipei/Download.ashx?u=document.pdf"


class AnnouncementDownloadTests(unittest.TestCase):
    def test_allows_official_listing_and_pdf_hosts(self):
        validate_announcement_url(LISTING_URL, LISTING_HOSTS)
        validate_announcement_url(PDF_URL, PDF_HOSTS)
        with self.assertRaises(ValueError):
            validate_announcement_url(PDF_URL, LISTING_HOSTS)

    def test_follows_approved_redirect_and_closes_intermediate_response(self):
        headers = Message()
        headers["Location"] = PDF_URL
        redirect_body = io.BytesIO(b"Unused intermediate response")
        redirect = HTTPError(LISTING_URL, 302, "Found", headers, redirect_body)
        with patch("announcement_download.urllib.request.build_opener") as build_opener:
            open_request = build_opener.return_value.open
            open_request.side_effect = [redirect, io.BytesIO(b"%PDF-document")]
            self.assertEqual(fetch_announcement(LISTING_URL, PDF_HOSTS, 100, 30), b"%PDF-document")
            self.assertEqual([call.args[0].full_url for call in open_request.call_args_list], [LISTING_URL, PDF_URL])
        self.assertTrue(redirect_body.closed)

    def test_stops_before_requesting_an_unapproved_redirect(self):
        headers = Message()
        headers["Location"] = "https://example.test/document.pdf"
        redirect = HTTPError(PDF_URL, 302, "Found", headers, io.BytesIO())
        with patch("announcement_download.urllib.request.build_opener") as build_opener:
            open_request = build_opener.return_value.open
            open_request.side_effect = redirect
            with self.assertRaises(ValueError):
                fetch_announcement(PDF_URL, PDF_HOSTS, 100, 30)
            open_request.assert_called_once()

    def test_read_limit_rejects_only_after_the_limit(self):
        self.assertEqual(read_bounded(io.BytesIO(b"123"), 3), b"123")
        stream = io.BytesIO(b"12345")
        with self.assertRaisesRegex(ValueError, "size limit"):
            read_bounded(stream, 3)
        self.assertEqual(stream.tell(), 4)
