import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jsonNoStore } from "./http";

export const IDLE_TIMEOUT = 30 * 60 * 1000;
export const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000;
export const MAX_SESSIONS = 32;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type Session = { created: number; touched: number };

// The factory also makes expiration/limiter behavior testable without real timers.
export function createAdminSessions(now = Date.now) {
  const sessions = new Map<string, Session>();
  let credentialDigest: string | undefined;
  let attempts: number[] = [];
  function synchronize() {
    const token = process.env.ADMIN_TOKEN;
    const next = token && token !== "change-me" ? digest(token) : undefined;
    if (next !== credentialDigest) { sessions.clear(); credentialDigest = next; }
    for (const [key, value] of sessions) {
      if (now() >= value.created + ABSOLUTE_TIMEOUT || now() >= value.touched + IDLE_TIMEOUT) sessions.delete(key);
    }
    return credentialDigest;
  }
  function lookup(identifier: string | undefined, touch = true) {
    if (!synchronize() || !identifier || !/^[a-f0-9]{64}$/.test(identifier)) return null;
    const value = sessions.get(digest(identifier));
    if (!value) return null;
    if (touch) value.touched = now();
    return { expiresAt: Math.min(value.created + ABSOLUTE_TIMEOUT, value.touched + IDLE_TIMEOUT) };
  }
  return {
    configured: () => Boolean(synchronize()),
    attempt() {
      attempts = attempts.filter(stamp => stamp > now() - 60000);
      if (attempts.length >= 10) return Math.max(1, Math.ceil((attempts[0] + 60000 - now()) / 1000));
      attempts.push(now());
      return 0;
    },
    login(token: string, previous?: string) {
      const expected = synchronize();
      if (!expected || !token || token.length > 4096 || !timingSafeEqual(Buffer.from(digest(token), "hex"), Buffer.from(expected, "hex"))) return { status: 401 as const };
      // A successful reauthentication replaces this browser's previous session.
      if (previous) sessions.delete(digest(previous));
      if (sessions.size >= MAX_SESSIONS) return { status: 503 as const };
      const identifier = randomBytes(32).toString("hex");
      const stamp = now();
      sessions.set(digest(identifier), { created: stamp, touched: stamp });
      return { status: 200 as const, identifier, expiresAt: stamp + IDLE_TIMEOUT };
    },
    lookup,
    logout(identifier: string | undefined) {
      synchronize();
      if (identifier && /^[a-f0-9]{64}$/.test(identifier)) sessions.delete(digest(identifier));
    },
  };
}
const shared = globalThis as typeof globalThis & { __psdAdminSessionsV1?: ReturnType<typeof createAdminSessions> };
export function adminSessions() { return shared.__psdAdminSessionsV1 ??= createAdminSessions(); }

function loopback(url: URL) { return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
function localHttp(request: Request) {
  const url = new URL(request.url);
  return url.protocol === "http:" && loopback(url) && (process.env.NODE_ENV !== "production" || process.env.ADMIN_ALLOW_LOOPBACK_HTTP === "1");
}
export function cookieName(request: Request) { return localHttp(request) ? "admin-session" : "__Host-admin-session"; }
export function sessionIdentifier(request: Request) {
  const name = cookieName(request);
  const values = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
  return values.length === 1 ? values[0].slice(name.length + 1) : undefined;
}
export function sessionCookie(request: Request, identifier: string, clear = false) {
  return `${cookieName(request)}=${identifier}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : ABSOLUTE_TIMEOUT / 1000}${localHttp(request) ? "" : "; Secure"}${clear ? "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : ""}`;
}
export function assertAdminMutation(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return null;
  const url = new URL(request.url);
  let expected: string;
  try {
    const configured = process.env.ADMIN_APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
    const target = configured ? new URL(configured) : url;
    if (configured && (target.username || target.password || target.pathname !== "/" || target.search || target.hash)) throw Error("invalid origin");
    // Next may normalize 127.0.0.1 to localhost in Request.url. The explicitly
    // configured browser origin still has to match exactly below; both sides of
    // the HTTP exception must remain loopback, with production opt-in required.
    if (target.protocol !== "https:" && !(target.protocol === "http:" && loopback(target) && localHttp(request))) throw Error("insecure origin");
    expected = target.origin;
  } catch { return jsonNoStore({ error: "Forbidden" }, { status: 403 }); }
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== expected || request.headers.get("x-admin-csrf") !== "1" || (site && site !== "same-origin")) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
