import assert from "node:assert/strict";
import test from "node:test";

const { createAdminSessions, ABSOLUTE_TIMEOUT, IDLE_TIMEOUT, MAX_SESSIONS, sessionCookie, sessionIdentifier, assertAdminMutation } = await import("../../.tmp-test/admin-session.js");
const { assertAdmin } = await import("../../.tmp-test/admin.js");

test("forbidden mutations do not refresh session idle lifetime", () => {
  process.env.ADMIN_TOKEN = "session-test-secret";
  process.env.ADMIN_APP_ORIGIN = "https://example.test";
  let stamp = 0;
  const store = createAdminSessions(() => stamp);
  const previous = globalThis.__psdAdminSessionsV1;
  globalThis.__psdAdminSessionsV1 = store;
  try {
    const session = store.login(process.env.ADMIN_TOKEN);
    stamp = 100;
    const request = origin => new Request("https://example.test/api", { method: "POST", headers: { cookie: `__Host-admin-session=${session.identifier}`, origin, "x-admin-csrf": "1" } });
    assert.equal(assertAdmin(request("https://other.example.test")).status, 403);
    assert.equal(store.lookup(session.identifier, false).expiresAt, IDLE_TIMEOUT);
    assert.equal(assertAdmin(request("https://example.test")), null);
    assert.equal(store.lookup(session.identifier, false).expiresAt, IDLE_TIMEOUT + stamp);
  } finally {
    globalThis.__psdAdminSessionsV1 = previous;
    delete process.env.ADMIN_APP_ORIGIN;
  }
});

test("opaque sessions enforce credential checks, 256-bit identifiers and revocation", () => {
  process.env.ADMIN_TOKEN = "session-test-secret";
  const store = createAdminSessions();
  assert.equal(store.login("incorrect").status, 401);
  assert.equal(store.lookup("0".repeat(64)), null);
  const a = store.login(process.env.ADMIN_TOKEN), b = store.login(process.env.ADMIN_TOKEN);
  assert.match(a.identifier, /^[a-f0-9]{64}$/);
  assert.notEqual(a.identifier, b.identifier);
  assert.ok(store.lookup(a.identifier));
  store.logout(a.identifier);
  assert.equal(store.lookup(a.identifier), null);
  assert.ok(store.lookup(b.identifier));
  process.env.ADMIN_TOKEN = "rotated-secret";
  assert.equal(store.lookup(b.identifier), null);
  const c = store.login(process.env.ADMIN_TOKEN);
  delete process.env.ADMIN_TOKEN;
  assert.equal(store.lookup(c.identifier), null);
  assert.equal(store.login("rotated-secret").status, 401);
  process.env.ADMIN_TOKEN = "change-me";
  assert.equal(store.configured(), false);
});

test("session expiration is server authoritative for idle and absolute lifetimes", () => {
  process.env.ADMIN_TOKEN = "session-test-secret";
  let stamp = 100000;
  const store = createAdminSessions(() => stamp);
  const idle = store.login(process.env.ADMIN_TOKEN);
  stamp += IDLE_TIMEOUT - 1;
  assert.ok(store.lookup(idle.identifier, false));
  stamp++;
  assert.equal(store.lookup(idle.identifier), null);
  const active = store.login(process.env.ADMIN_TOKEN);
  const start = stamp;
  while (stamp < start + ABSOLUTE_TIMEOUT - IDLE_TIMEOUT) {
    stamp += IDLE_TIMEOUT - 1;
    assert.ok(store.lookup(active.identifier));
  }
  stamp = start + ABSOLUTE_TIMEOUT;
  assert.equal(store.lookup(active.identifier), null);
});

test("bounded capacity recovers with expiry and replaces a valid existing session", () => {
  process.env.ADMIN_TOKEN = "session-test-secret";
  let stamp = 0;
  const store = createAdminSessions(() => stamp);
  const identifiers = Array.from({ length: MAX_SESSIONS }, () => store.login(process.env.ADMIN_TOKEN).identifier);
  assert.equal(store.login(process.env.ADMIN_TOKEN).status, 503);
  const replacement = store.login(process.env.ADMIN_TOKEN, identifiers[0]);
  assert.equal(replacement.status, 200);
  assert.equal(store.lookup(identifiers[0]), null);
  stamp += IDLE_TIMEOUT;
  assert.equal(store.login(process.env.ADMIN_TOKEN).status, 200);
});

test("process-wide login limiter admits ten attempts and recovers at rolling boundary", () => {
  let stamp = 100;
  const store = createAdminSessions(() => stamp);
  for (let i = 0; i < 10; i++) assert.equal(store.attempt(), 0);
  assert.equal(store.attempt(), 60);
  stamp += 59001;
  assert.equal(store.attempt(), 1);
  stamp += 999;
  assert.equal(store.attempt(), 0);
});

test("production cookies remain host-only Secure while HTTP exceptions are loopback restricted", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.ADMIN_ALLOW_LOOPBACK_HTTP;
  const https = new Request("https://example.test/api");
  const cookie = sessionCookie(https, "a".repeat(64));
  assert.match(cookie, /^__Host-admin-session=/);
  for (const attribute of ["Path=/", "HttpOnly", "SameSite=Strict", "Secure", "Max-Age=28800"]) assert.ok(cookie.includes(attribute));
  assert.ok(!cookie.includes("Domain"));
  assert.match(sessionCookie(https, "", true), /Max-Age=0; Secure; Expires=/);
  process.env.ADMIN_ALLOW_LOOPBACK_HTTP = "1";
  assert.match(sessionCookie(new Request("http://127.0.0.1:3000"), "a"), /^admin-session=/);
  assert.match(sessionCookie(new Request("http://evil.test"), "a"), /; Secure/);
  assert.equal(sessionIdentifier(new Request("https://example.test", { headers: { cookie: "__Host-admin-session=a; __Host-admin-session=b" } })), undefined);
  assert.equal(sessionIdentifier(new Request("https://example.test", { headers: { cookie: "other=a; __Host-admin-session=b" } })), "b");
  if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original;
  delete process.env.ADMIN_ALLOW_LOOPBACK_HTTP;
});

test("mutations require exact trusted origin and custom header and ignore forwarded headers", () => {
  process.env.ADMIN_APP_ORIGIN = "https://public.example.test";
  const request = headers => new Request("https://internal.example.test/api", { method: "POST", headers });
  assert.equal(assertAdminMutation(request({ origin: process.env.ADMIN_APP_ORIGIN, "x-admin-csrf": "1" })), null);
  assert.equal(assertAdminMutation(request({ origin: "https://evil.test", "x-admin-csrf": "1", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" })).status, 403);
  assert.equal(assertAdminMutation(request({ origin: process.env.ADMIN_APP_ORIGIN })).status, 403);
  assert.equal(assertAdminMutation(request({ "x-admin-csrf": "1" })).status, 403);
  assert.equal(assertAdminMutation(request({ origin: process.env.ADMIN_APP_ORIGIN, "x-admin-csrf": "1", "sec-fetch-site": "cross-site" })).status, 403);
  process.env.ADMIN_APP_ORIGIN = "https://public.example.test/not-an-origin";
  assert.equal(assertAdminMutation(request({ origin: "https://public.example.test", "x-admin-csrf": "1" })).status, 403);
  delete process.env.ADMIN_APP_ORIGIN;
  delete process.env.RENDER_EXTERNAL_URL;
  assert.equal(assertAdminMutation(new Request("http://evil.test/api", { method: "POST", headers: { origin: "http://evil.test", "x-admin-csrf": "1" } })).status, 403);
});

test("explicit loopback browser origin tolerates Next localhost normalization without permitting remote HTTP", () => {
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.ADMIN_ALLOW_LOOPBACK_HTTP = "1";
  process.env.ADMIN_APP_ORIGIN = "http://127.0.0.1:3100";
  const request = (url, origin = process.env.ADMIN_APP_ORIGIN) => new Request(url, { method: "POST", headers: { origin, "x-admin-csrf": "1" } });
  try {
    assert.equal(assertAdminMutation(request("http://localhost:3100/api")), null);
    assert.equal(assertAdminMutation(request("http://localhost:3100/api", "http://localhost:3100")).status, 403);
    assert.equal(assertAdminMutation(request("http://remote.test/api")).status, 403);
    delete process.env.ADMIN_ALLOW_LOOPBACK_HTTP;
    assert.equal(assertAdminMutation(request("http://localhost:3100/api")).status, 403);
    process.env.ADMIN_ALLOW_LOOPBACK_HTTP = "1";
    process.env.ADMIN_APP_ORIGIN = "http://remote.test";
    assert.equal(assertAdminMutation(request("http://localhost:3100/api")).status, 403);
  } finally {
    if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
    delete process.env.ADMIN_ALLOW_LOOPBACK_HTTP;
    delete process.env.ADMIN_APP_ORIGIN;
  }
});
