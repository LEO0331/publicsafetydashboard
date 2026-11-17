import { NextRequest } from "next/server";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";
import { ImportBodyTooLargeError, isOfficialAnnouncementUrl, readBoundedImportBody } from "../../../../src/server/announcement-import";
import { jsonNoStore } from "../../../../src/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await (await readBoundedImportBody(request, 16 * 1024)).json();
  } catch (error) {
    if (error instanceof ImportBodyTooLargeError) {
      return jsonNoStore({ error: "The import request is too large" }, { status: 413 });
    }
    return jsonNoStore({ error: "Invalid JSON import request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" || !body.url.trim()) {
    return jsonNoStore({ error: "url is required" }, { status: 400 });
  }
  const url = body.url.trim();
  if (!isOfficialAnnouncementUrl(url)) {
    return jsonNoStore({ error: "Use an HTTPS link on an approved Taipei announcement host" }, { status: 400 });
  }
  const title = "title" in body && typeof body.title === "string" && body.title.trim() ? body.title : "Manual PDF URL import";
  try {
    const result = await runPythonScript(["scripts/import_pdf.py", "--url", url, `--title=${title}`]);
    return jsonNoStore(result);
  } catch {
    return jsonNoStore({ error: "Unable to import the PDF" }, { status: 422 });
  }
}
