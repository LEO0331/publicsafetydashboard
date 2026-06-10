import { NextRequest } from "next/server";
import { assertAdmin } from "../../../../src/server/admin";
import { jsonNoStore, readJsonObject } from "../../../../src/server/http";
import { setRecordHidden, setSourceHidden } from "../../../../src/server/queries";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonObject(request);
  const id = Number(body?.id);
  if (!body || !Number.isInteger(id) || id <= 0 || typeof body.hidden !== "boolean" || (body.target !== "source" && body.target !== "record")) {
    return jsonNoStore({ error: "Invalid hide request" }, { status: 400 });
  }

  const changes = body.target === "source" ? setSourceHidden(id, body.hidden) : setRecordHidden(id, body.hidden);
  if (!changes) {
    return jsonNoStore({ error: "Target not found" }, { status: 404 });
  }
  return jsonNoStore({ ok: true, target: body.target, id, hidden: body.hidden });
}
