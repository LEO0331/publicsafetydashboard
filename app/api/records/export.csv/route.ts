import { observe } from "../../../../src/server/observability";
import { getExportRecords, MAX_EXPORT_ROWS } from "../../../../src/server/queries";
import { noStoreHeaders, jsonNoStore } from "../../../../src/server/http";

export const runtime = "nodejs";

const headers = ["name", "violation_date", "violation_count", "violation_types", "location", "alcohol_mg_per_l", "source_title", "pdf_url"];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@＝＋－＠\t\r\n]/.test(text) ? `'${text}` : text;
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

export const GET = observe("export", async (request, context) => {
  const params = new URL(request.url).searchParams;
  const rows = getExportRecords({
    violationCount: params.get("violationCount"),
    type: params.get("type"),
    location: params.get("location"),
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
  });
  if (rows.length > MAX_EXPORT_ROWS) return jsonNoStore({ error: "Export exceeds 10,000 rows; narrow filters" }, { status: 413 });
  const lines = [headers.map(csvCell).join(",")];
  let bytes = Buffer.byteLength(lines[0]) + 4;
  for (const row of rows) {
    const line =
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
        .join(",");
    bytes += Buffer.byteLength(line) + 1;
    if (bytes > 8 * 1024 * 1024) return jsonNoStore({ error: "Export exceeds 8 MiB; narrow filters" }, { status: 413 });
    lines.push(line);
  }
  const body = lines.join("\n");
  context.rows(rows.length);

  return new Response(`\uFEFF${body}\n`, {
    headers: noStoreHeaders({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="taipei-public-safety-records.csv"',
    }),
  });
});
