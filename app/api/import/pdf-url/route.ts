import { NextRequest } from "next/server";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";
import { jsonNoStore, readJsonObject } from "../../../../src/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonObject(request);
  if (typeof body.url !== "string" || !body.url.trim()) {
    return jsonNoStore({ error: "url is required" }, { status: 400 });
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title : "Manual PDF URL import";
  const result = await runPythonScript(["scripts/import_pdf.py", "--url", body.url, "--title", title]);
  return jsonNoStore(result);
}
