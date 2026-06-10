import { NextRequest } from "next/server";
import { assertAdmin, runPythonScript } from "../../../../src/server/admin";
import { jsonNoStore, readJsonObject } from "../../../../src/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonObject(request);
  const args = ["scripts/geocode_locations.py"];
  args.push("--limit", String(body.limit || 5));
  args.push("--delay", String(body.delay || 10));
  const result = await runPythonScript(args);
  return jsonNoStore(result);
}
