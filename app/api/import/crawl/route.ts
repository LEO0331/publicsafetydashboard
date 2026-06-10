import { NextRequest } from "next/server";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";
import { jsonNoStore, readJsonObject } from "../../../../src/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonObject(request);
  const args = ["scripts/crawl_sources.py"];
  if (body.maxPages) args.push("--max-pages", String(body.maxPages));
  if (body.pageSize) args.push("--page-size", String(body.pageSize));
  const result = await runPythonScript(args);
  return jsonNoStore(result);
}
