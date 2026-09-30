from __future__ import annotations

import argparse
import re
import time
import urllib.parse
import urllib.request
import unicodedata
from dataclasses import dataclass
from html.parser import HTMLParser

from common import USER_AGENT, connect_db, log_import, normalize_space, parse_taiwan_date

BASE_URL = "https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170"
ROC_DATE = re.compile(r"(?<!\d)(?P<year>\d{2,3})\s*(?:[./-]|年)\s*(?P<month>\d{1,2})\s*(?:[./-]|月)\s*(?P<day>\d{1,2})\s*日?(?!\d)")


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


def is_regular_repeat_offender_announcement(title: str) -> bool:
    """Recognize regular Taipei DOT releases across ROC years and historical wording."""
    normalized = unicodedata.normalize("NFKC", title or "").replace("台北市", "臺北市")
    date = ROC_DATE.search(normalized)
    if not date or int(date.group("year")) == 0 or parse_taiwan_date(date.group()) is None:
        return False

    wording = re.sub(r"[^\w\u4e00-\u9fff]", "", normalized[date.end():])
    if "三次以上且設籍本市者" in wording:
        return False
    if not all(part in wording for part in ("臺北市", "累犯", "公布名單")):
        return False
    if "拒測" in wording:
        return bool(re.search(r"酒(?:毒)?駕|酒(?:毒)?及拒測駕", wording))
    # The earliest regular releases used this exact shorter series name.
    return bool(re.fullmatch(r"臺北市(?:第\d+次)?酒駕累犯公布名單(?:pdf)?", wording))


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
        eligible_links = [link for link in new_links if is_regular_repeat_offender_announcement(link.title)]
        if eligible_links:
            total_inserted += upsert_sources(eligible_links)
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
