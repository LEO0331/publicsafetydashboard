import { getLocations } from "../../../src/server/queries";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";

export function GET() {
  return jsonNoStore(getLocations());
}
