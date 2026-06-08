import assert from "node:assert/strict";
import test from "node:test";

const { assertAdmin } = await import("../../.tmp-test/admin.js");

function requestWithToken(token) {
  const headers = new Headers();
  if (token) headers.set("x-admin-token", token);
  return new Request("https://example.test/admin", { headers });
}

test("admin auth fails closed when token is missing or placeholder", async () => {
  delete process.env.ADMIN_TOKEN;
  let response = assertAdmin(requestWithToken("anything"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Admin token is not configured" });

  process.env.ADMIN_TOKEN = "change-me";
  response = assertAdmin(requestWithToken("change-me"));
  assert.equal(response.status, 503);
});

test("admin auth rejects missing or wrong request token", async () => {
  process.env.ADMIN_TOKEN = "test-secret";

  let response = assertAdmin(requestWithToken(""));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });

  response = assertAdmin(requestWithToken("wrong-secret"));
  assert.equal(response.status, 401);
});

test("admin auth accepts exact configured token", () => {
  process.env.ADMIN_TOKEN = "test-secret";

  const response = assertAdmin(requestWithToken("test-secret"));
  assert.equal(response, null);
});
