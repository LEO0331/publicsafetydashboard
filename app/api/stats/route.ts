import { getStats } from "../../../src/server/queries";

export const runtime = "nodejs";

export function GET() {
  return Response.json(getStats());
}
