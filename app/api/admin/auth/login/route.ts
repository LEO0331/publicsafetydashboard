import { adminSessions, assertAdminMutation, sessionCookie, sessionIdentifier } from "../../../../../src/server/admin-session";
import { ImportBodyTimeoutError, ImportBodyTooLargeError, readBoundedImportBody } from "../../../../../src/server/announcement-import";
import { jsonNoStore } from "../../../../../src/server/http";
import { recordAuthentication } from "../../../../../src/server/observability";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = assertAdminMutation(request);
  if (denied) return denied;
  const store = adminSessions();
  const retry = store.attempt();
  if (retry) {
    recordAuthentication("auth_login_limited", 429);
    return jsonNoStore({ error: "Authentication failed" }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  try {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new SyntaxError();
    const bounded = await readBoundedImportBody(request, 8192, 5000);
    const body: unknown = JSON.parse(await bounded.text());
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("token" in body) || typeof body.token !== "string" || body.token.length > 4096) throw new SyntaxError();
    if (!store.configured()) {
      recordAuthentication("auth_login_failed", 503);
      return jsonNoStore({ error: "Authentication failed" }, { status: 503 });
    }
    const result = store.login(body.token, sessionIdentifier(request));
    if (result.status !== 200) {
      recordAuthentication("auth_login_failed", result.status);
      return jsonNoStore({ error: "Authentication failed" }, { status: result.status });
    }
    recordAuthentication("auth_login", 200);
    return jsonNoStore({ authenticated: true, expiresAt: result.expiresAt }, { headers: { "Set-Cookie": sessionCookie(request, result.identifier) } });
  } catch (error) {
    const status = error instanceof ImportBodyTooLargeError ? 413 : error instanceof ImportBodyTimeoutError ? 408 : 400;
    recordAuthentication("auth_login_failed", status);
    return jsonNoStore({ error: "Authentication failed" }, { status });
  }
}
