import { adminSessions, sessionCookie, sessionIdentifier } from "../../../../../src/server/admin-session";
import { jsonNoStore } from "../../../../../src/server/http";
import { recordAuthentication } from "../../../../../src/server/observability";

export const runtime = "nodejs";
export function GET(request: Request) {
  const identifier = sessionIdentifier(request);
  // Status polling does not extend idle lifetime or inflate successful-request metrics.
  const session = adminSessions().lookup(identifier, false);
  if (session) return jsonNoStore({ authenticated: true, expiresAt: session.expiresAt });
  if (identifier) recordAuthentication("auth_session_invalid", 401);
  return jsonNoStore({ authenticated: false }, { headers: { "Set-Cookie": sessionCookie(request, "", true) } });
}
