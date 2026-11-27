import { observe } from "../../../src/server/observability";
import { getLocations } from "../../../src/server/queries";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";

export const GET = observe("locations", async () => {
  return jsonNoStore(getLocations());
});
