import { adminSessions, assertAdminMutation, sessionCookie, sessionIdentifier } from "../../../../../src/server/admin-session";
import { jsonNoStore } from "../../../../../src/server/http";
import { recordAuthentication } from "../../../../../src/server/observability";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = assertAdminMutation(request);
  if (denied) return denied;
  adminSessions().logout(sessionIdentifier(request));
  recordAuthentication("auth_logout", 200);
  return jsonNoStore({ authenticated: false }, { headers: { "Set-Cookie": sessionCookie(request, "", true) } });
}
