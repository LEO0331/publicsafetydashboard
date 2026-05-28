from __future__ import annotations

import argparse
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser

from common import USER_AGENT, connect_db, log_import, normalize_space, parse_taiwan_date

BASE_URL = "https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170"


@dataclass(frozen=True)
class PdfLink:
    title: str
    pdf_url: str
    source_url: str
    published_date: int | None


class TaipeiDotParser(HTMLParser):
    def __init__(self, page_url: str):
        super().__init__()
        self.page_url = page_url
        self.anchors: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []
        self.page_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            attrs_dict = dict(attrs)
            self._href = attrs_dict.get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        self.page_text.append(data)
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.anchors.append((self._href, normalize_space("".join(self._text))))
            self._href = None
            self._text = []


def page_url(page: int, page_size: int) -> str:
    return f"{BASE_URL}&page={page}&PageSize={page_size}"


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", errors="replace")


def extract_pdf_links(html: str, source_url: str) -> list[PdfLink]:
    parser = TaipeiDotParser(source_url)
    parser.feed(html)
    body = normalize_space(" ".join(parser.page_text))
    fallback_date = parse_taiwan_date(body)
    links: list[PdfLink] = []
    for href, title in parser.anchors:
        absolute = urllib.parse.urljoin(source_url, href)
        decoded = urllib.parse.unquote(absolute)
        if ".pdf" not in decoded.lower() and "download.ashx" not in decoded.lower():
            continue
        links.append(
            PdfLink(
                title=title or "Taipei DOT PDF announcement",
                pdf_url=absolute,
                source_url=source_url,
                published_date=parse_taiwan_date(title) or fallback_date,
            )
        )
    return links


def upsert_sources(links: list[PdfLink]) -> int:
    if not links:
        return 0
    inserted = 0
    with connect_db() as conn:
        for link in links:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO sources
                    (title, source_url, pdf_url, published_date, parse_status)
                VALUES (?, ?, ?, ?, 'discovered')
                """,
                (link.title, link.source_url, link.pdf_url, link.published_date),
            )
            inserted += cur.rowcount
            log_import(f"source_discovered source={link.source_url} pdf={link.pdf_url}")
    return inserted


def crawl(page_size: int = 20, delay_seconds: float = 1.0, max_pages: int | None = None) -> int:
    seen: set[str] = set()
    total_inserted = 0
    page = 1
    while max_pages is None or page <= max_pages:
        url = page_url(page, page_size)
        log_import(f"crawl_page url={url}")
        html = fetch_html(url)
        links = extract_pdf_links(html, url)
        new_links = [link for link in links if link.pdf_url not in seen]
        for link in new_links:
            seen.add(link.pdf_url)
        if not new_links:
            break
        total_inserted += upsert_sources(new_links)
        page += 1
        time.sleep(delay_seconds)
    return total_inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl Taipei DOT repeat-offender PDF announcements.")
    parser.add_argument("--page-size", type=int, default=20)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--max-pages", type=int)
    args = parser.parse_args()
    inserted = crawl(page_size=args.page_size, delay_seconds=args.delay, max_pages=args.max_pages)
    print(f"Inserted {inserted} new sources")


if __name__ == "__main__":
    main()
