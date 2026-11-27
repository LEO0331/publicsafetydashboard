import { observe } from "../../../../src/server/observability";
import { jsonNoStore, readJsonObject } from "../../../../src/server/http";
import { setRecordHidden, setSourceHidden } from "../../../../src/server/queries";

export const runtime = "nodejs";

export const POST = observe("admin_hide", async (request) => {
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
}, { admin: true, maintenance: true });
