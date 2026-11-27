import assert from "node:assert/strict";
import test from "node:test";

const { assertAdmin } = await import("../../.tmp-test/admin.js");
const { adminSessions } = await import("../../.tmp-test/admin-session.js");
const { boundedNumber } = await import("../../.tmp-test/http.js");

function requestWithToken(token) {
  const headers = new Headers();
  if (token) headers.set("x-admin-token", token);
  return new Request("https://example.test/admin", { headers });
}

test("admin auth fails closed when token is missing or placeholder", async () => {
  delete process.env.ADMIN_TOKEN;
  let response = assertAdmin(requestWithToken("anything"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  process.env.ADMIN_TOKEN = "change-me";
  response = assertAdmin(requestWithToken("change-me"));
  assert.equal(response.status, 503);
});

test("admin auth rejects missing credentials and retired reusable token headers", async () => {
  process.env.ADMIN_TOKEN = "test-secret";
  for (const token of ["", "wrong-secret", "test-secret"]) {
    const response = assertAdmin(requestWithToken(token));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
});

test("admin auth accepts shared cookie sessions across routes and rejects unsafe mutations", () => {
  process.env.ADMIN_TOKEN = "test-secret";
  const login = adminSessions().login("test-secret");
  assert.equal(login.status, 200);
  const headers = { cookie: "__Host-admin-session=" + login.identifier };
  for (const path of ["/api/admin/review", "/api/import/logs", "/api/admin/security?format=jsonl"]) {
    assert.equal(assertAdmin(new Request("https://example.test" + path, { headers })), null);
  }
  assert.equal(assertAdmin(new Request("https://example.test/api/admin/hide", {method:"POST", headers})).status, 403);
  assert.equal(assertAdmin(new Request("https://example.test/api/admin/hide", {method:"POST", headers:{...headers, origin:"https://example.test", "x-admin-csrf":"1"}})), null);
  adminSessions().logout(login.identifier);
  assert.equal(assertAdmin(new Request("https://example.test/api/admin/review", { headers })).status,401);
});

test("bounded number helper clamps admin maintenance inputs", () => {
  assert.equal(boundedNumber("10", 5, 1, 25), 10);
  assert.equal(boundedNumber("0", 5, 1, 25), 1);
  assert.equal(boundedNumber("999", 5, 1, 25), 25);
  assert.equal(boundedNumber("not-a-number", 5, 1, 25), 5);
});
