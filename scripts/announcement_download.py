from __future__ import annotations

import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError

from common import USER_AGENT

LISTING_HOSTS = frozenset({"dot.gov.taipei"})
PDF_HOSTS = LISTING_HOSTS | {"www-ws.gov.taipei"}
MAX_LISTING_BYTES = 4 * 1024 * 1024
MAX_PDF_BYTES = 20 * 1024 * 1024
MAX_REDIRECTS = 5
REDIRECT_CODES = {301, 302, 303, 307, 308}


def validate_announcement_url(url: str, allowed_hosts: frozenset[str] = PDF_HOSTS) -> None:
    if any(character.isspace() or ord(character) < 32 or ord(character) == 127 for character in url):
        raise ValueError("Announcement URLs must not contain whitespace or control characters")
    if "\\" in url or "#" in url:
        raise ValueError("Invalid announcement URL")
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname
    if (
        parsed.scheme != "https"
        or host not in allowed_hosts
        or parsed.netloc.lower() not in {host, f"{host}:443"}
    ):
        raise ValueError("Only HTTPS URLs on approved Taipei announcement hosts are allowed")


class NoAutomaticRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_bounded(stream, max_bytes: int) -> bytes:
    content = stream.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise ValueError("Announcement exceeds the size limit")
    return content


def fetch_announcement(url: str, allowed_hosts: frozenset[str], max_bytes: int, timeout: int) -> bytes:
    deadline = time.monotonic() + timeout
    opener = urllib.request.build_opener(NoAutomaticRedirects())
    for _ in range(MAX_REDIRECTS + 1):
        validate_announcement_url(url, allowed_hosts)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Announcement request timed out")
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with opener.open(request, timeout=remaining) as response:
                return read_bounded(response, max_bytes)
        except HTTPError as error:
            with error:
                location = error.headers.get("location")
                if error.code not in REDIRECT_CODES or not location:
                    raise
            url = urllib.parse.urljoin(url, location)
    raise ValueError("Too many announcement redirects")
