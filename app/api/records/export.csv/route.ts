import { getExportRecords } from "../../../../src/server/queries";
import { noStoreHeaders } from "../../../../src/server/http";

export const runtime = "nodejs";

const headers = ["name", "violation_date", "violation_count", "violation_types", "location", "alcohol_mg_per_l", "source_title", "pdf_url"];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function formatDateMs(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString().slice(0, 10) : "";
}

function formatTypes(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").join(";") : "";
  } catch {
    return "";
  }
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rows = getExportRecords({
    violationCount: params.get("violationCount"),
    type: params.get("type"),
    location: params.get("location"),
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
  }) as Record<string, unknown>[];
  const body = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.name,
        formatDateMs(row.violation_date),
        row.violation_count,
        formatTypes(row.violation_types_json),
        row.location_text,
        row.alcohol_mg_per_l,
        row.source_title,
        row.pdf_url,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");

  return new Response(`\uFEFF${body}\n`, {
    headers: noStoreHeaders({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="taipei-public-safety-records.csv"',
    }),
  });
}
