import { NextRequest } from "next/server";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }
  const result = await runPythonScript(["scripts/import_pdf.py", "--url", body.url, "--title", body.title ?? "Manual PDF URL import"]);
  return Response.json(result);
}
