import { NextRequest } from "next/server";
import { assertAdmin } from "../../../../src/server/admin";
import { setRecordHidden, setSourceHidden } from "../../../../src/server/queries";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as { target?: string; id?: unknown; hidden?: unknown } | null;
  const id = Number(body?.id);
  const hidden = Boolean(body?.hidden);
  if (!body || !Number.isInteger(id) || id <= 0 || (body.target !== "source" && body.target !== "record")) {
    return Response.json({ error: "Invalid hide request" }, { status: 400 });
  }

  const changes = body.target === "source" ? setSourceHidden(id, hidden) : setRecordHidden(id, hidden);
  if (!changes) {
    return Response.json({ error: "Target not found" }, { status: 404 });
  }
  return Response.json({ ok: true, target: body.target, id, hidden });
}
