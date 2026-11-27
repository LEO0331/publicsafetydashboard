import { observe } from "../../../../src/server/observability";
import { runPythonScript } from "../../../../src/server/admin";
import { boundedNumber, jsonNoStore, readJsonObject } from "../../../../src/server/http";

export const runtime = "nodejs";

export const POST = observe("import_crawl", async (request) => {
  const body = await readJsonObject(request);
  const args = ["scripts/crawl_sources.py"];
  if (body.maxPages) args.push("--max-pages", String(Math.trunc(boundedNumber(body.maxPages, 1, 1, 20))));
  if (body.pageSize) args.push("--page-size", String(Math.trunc(boundedNumber(body.pageSize, 20, 1, 200))));
  const result = await runPythonScript(args);
  return jsonNoStore(result);
}, { admin: true, maintenance: true });
