import type { getExportRecords } from "./queries";
import { MAX_EXPORT_ROWS } from "./export-limits";

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

export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
export function buildCsv(rows: ReturnType<typeof getExportRecords>, maxBytes = MAX_EXPORT_BYTES) {
  if (rows.length > MAX_EXPORT_ROWS) return null;
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
    if (bytes > maxBytes) return null;
    lines.push(line);
  }
  return `\uFEFF${lines.join("\n")}\n`;
}
