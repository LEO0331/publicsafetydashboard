import { observe } from "../../../src/server/observability";
import { getStats } from "../../../src/server/queries";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";

export const GET = observe("stats", async () => {
  return jsonNoStore(getStats());
});
