import { observe } from "../../../../src/server/observability";
import { runPythonScript } from "../../../../src/server/admin";
import { boundedNumber, jsonNoStore, readJsonObject } from "../../../../src/server/http";

export const runtime = "nodejs";

export const POST = observe("import_geocode", async (request) => {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonObject(request);
  const args = ["scripts/geocode_locations.py"];
  args.push("--limit", String(Math.trunc(boundedNumber(body.limit, 5, 1, 25))));
  args.push("--delay", String(boundedNumber(body.delay, 16, 16, 60)));
  const result = await runPythonScript(args);
  return jsonNoStore(result);
}, { admin: true, maintenance: true });
