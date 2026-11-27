import { observe, securityReport, enabled, securityBackup, securityCsv, restoreSecurity, MAX_RESTORE_BYTES } from "../../../../src/server/observability";
import { jsonNoStore, noStoreHeaders } from "../../../../src/server/http";
import { readBoundedImportBody } from "../../../../src/server/announcement-import";

export const runtime = "nodejs";
export const GET = observe("security_report", request => {
  const format = new URL(request.url).searchParams.get("format");
  if (!format) return jsonNoStore(securityReport());
  if (!enabled()) return jsonNoStore({ enabled: false }, { status: 409 });
  if (format !== "csv" && format !== "jsonl") return jsonNoStore({ error: "Invalid report format" }, { status: 400 });
  return new Response(format === "csv" ? securityCsv() : securityBackup(), {
    headers: noStoreHeaders({
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8",
      "content-disposition": 'attachment; filename="public-safety-security.' + format + '"',
    }),
  });
}, { admin: true, report: true });

export const POST = observe("security_report", async request => {
  if (!enabled()) return jsonNoStore({ enabled: false }, { status: 409 });
  const site = request.headers.get("sec-fetch-site");
  if ((site && site !== "same-origin") || request.headers.get("x-security-restore") !== "1" ||
    request.headers.get("content-type") !== "text/plain") return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  const body = await readBoundedImportBody(request, MAX_RESTORE_BYTES, 10000);
  try { return jsonNoStore(restoreSecurity(await body.text())); }
  catch { return jsonNoStore({ error: "Invalid aggregate backup" }, { status: 400 }); }
}, { admin: true, maintenance: true, report: true });
