from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from common import normalize_space, parse_taiwan_date


@dataclass
class ParsedRecord:
    sequence_no: str | None
    name: str | None
    violation_date: int | None
    law_article: str | None
    location_text: str | None
    fact_text: str | None
    violation_count: int | None
    violation_types: list[str]
    alcohol_mg_per_l: float | None
    unlicensed: bool
    has_photo: bool
    parser_confidence: float
    needs_review: bool


def parse_violation_count(text: str | None) -> int | None:
    match = re.search(r"第\s*(\d+)\s*次(?:以上)?", text or "")
    return int(match.group(1)) if match else None


def parse_violation_types(text: str | None) -> list[str]:
    value = text or ""
    types: list[str] = []
    if "酒駕" in value or "酒後" in value or "吐氣" in value or "酒精" in value:
        types.append("酒駕")
    if any(token in value for token in ("毒駕", "藥駕", "吸食毒品", "毒品")):
        types.append("毒駕/藥駕")
    if "拒測" in value or "拒絕" in value:
        types.append("拒測")
    if "無照" in value:
        types.append("無照")
    return types


def parse_alcohol_mg_per_l(text: str | None) -> float | None:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*mg\s*/?\s*l", text or "", re.IGNORECASE)
    return float(match.group(1)) if match else None


def confidence_for(record: ParsedRecord) -> float:
    required = [
        record.name,
        record.violation_date,
        record.location_text,
        record.fact_text,
    ]
    return sum(1 for value in required if value) / len(required)


def row_to_record(row: dict[str, str]) -> ParsedRecord:
    fact = normalize_space(row.get("違規事實") or row.get("factText"))
    law = normalize_space(row.get("違規條款") or row.get("lawArticle"))
    combined = f"{law} {fact}"
    record = ParsedRecord(
        sequence_no=normalize_space(row.get("序號") or row.get("sequenceNo")) or None,
        name=normalize_space(row.get("姓名") or row.get("name")) or None,
        violation_date=parse_taiwan_date(row.get("違規日") or row.get("violationDate")),
        law_article=law or None,
        location_text=normalize_space(row.get("違規地點") or row.get("locationText")) or None,
        fact_text=fact or None,
        violation_count=parse_violation_count(fact),
        violation_types=parse_violation_types(combined),
        alcohol_mg_per_l=parse_alcohol_mg_per_l(fact),
        unlicensed="無照" in combined,
        has_photo=False,
        parser_confidence=0,
        needs_review=True,
    )
    record.parser_confidence = confidence_for(record)
    record.needs_review = record.parser_confidence < 1 or not record.violation_types
    return record


def rows_from_text(text: str) -> list[dict[str, str]]:
    lines = [normalize_space(line) for line in text.splitlines()]
    lines = [line for line in lines if line]
    starts: list[int] = []
    for index, line in enumerate(lines):
        if re.match(r"^\d+\s+", line):
            starts.append(index)
    rows: list[dict[str, str]] = []
    for pos, start in enumerate(starts):
        end = starts[pos + 1] if pos + 1 < len(starts) else len(lines)
        chunk = " ".join(lines[start:end])
        match = re.match(r"^(?P<seq>\d+)\s+(?P<name>\S+)\s+(?P<date>\d{2,4}[./-]\d{1,2}[./-]\d{1,2})\s+(?P<rest>.+)$", chunk)
        if not match:
            rows.append({"序號": chunk.split(" ", 1)[0], "違規事實": chunk})
            continue
        rest = match.group("rest")
        location = ""
        fact = rest
        location_match = re.search(r"(臺北市|台北市)?\S+(路|街|大道|橋|巷|段|區|口)\S*", rest)
        if location_match:
            location = location_match.group(0)
            fact = rest.replace(location, " ", 1)
        rows.append(
            {
                "序號": match.group("seq"),
                "姓名": match.group("name"),
                "違規日": match.group("date"),
                "違規地點": location,
                "違規事實": fact,
            }
        )
    return rows


def records_from_rows(rows: Iterable[dict[str, str]]) -> list[ParsedRecord]:
    return [row_to_record(row) for row in rows]


def rows_from_table(table: list[list[str | None]]) -> list[dict[str, str]]:
    header_index = next(
        (
            index
            for index, raw in enumerate(table)
            if {"序號", "姓名", "違規日", "違規條款", "違規地點", "違規事實"}.issubset({normalize_space(cell) for cell in raw})
        ),
        None,
    )
    if header_index is None:
        return []
    headers = [normalize_space(cell) for cell in table[header_index]]
    rows: list[dict[str, str]] = []
    for raw in table[header_index + 1 :]:
        row = {headers[i]: normalize_space(raw[i]) for i in range(min(len(headers), len(raw))) if headers[i]}
        if normalize_space(row.get("序號")):
            rows.append(row)
    return rows


def records_from_pdf(path: str) -> list[ParsedRecord]:
    try:
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError("pdfplumber is required for PDF parsing. Install requirements.txt.") from exc

    table_rows: list[dict[str, str]] = []
    text_pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text_pages.append(page.extract_text() or "")
            for table in page.extract_tables() or []:
                if not table:
                    continue
                table_rows.extend(rows_from_table(table))
    if table_rows:
        return records_from_rows(table_rows)
    return records_from_rows(rows_from_text("\n".join(text_pages)))
