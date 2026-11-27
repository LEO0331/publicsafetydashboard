import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// A separate process loads the real Route Handlers and gives the shared limiter a
// controllable clock without changing production code or other integration tests.
test("real auth handlers bound login bodies, recover rate limits, revoke cookies and redact events", () => {
  const result = spawnSync(process.execPath, ["--require", "tsx/cjs", "-e", String.raw`
    const assert = require("node:assert/strict");
    let now = Date.parse("2026-11-27T00:00:00Z");
    Date.now = () => now;
    process.env.ADMIN_TOKEN = "ENDPOINT-PRIVATE-TOKEN";
    process.env.ENABLE_API_OBSERVABILITY = "true";
    const events = [];
    const write = process.stdout.write;
    process.stdout.write = value => { events.push(String(value)); return true; };
    const { POST: login } = require("./app/api/admin/auth/login/route.ts");
    const { POST: logout } = require("./app/api/admin/auth/logout/route.ts");
    const { GET: session } = require("./app/api/admin/auth/session/route.ts");
    const { assertAdmin } = require("./src/server/admin.ts");
    const request = (body, extra = {}) => new Request("https://example.test/api/admin/auth/login", {
      method: "POST", headers: { origin: "https://example.test", "x-admin-csrf": "1", "content-type": "application/json", ...extra }, body,
    });
    (async () => {
      for (const [body, extra, status] of [
        ["{bad", {}, 400], ["[]", {}, 400], [JSON.stringify({token:"x", unexpected:true}), {},400],
        [JSON.stringify({token:"x"}), {"content-type":"text/plain"},400], ["x".repeat(8193), {},413],
        [JSON.stringify({token:"wrong"}), {},401],
      ]) {
        const response = await login(request(body, extra));
        assert.equal(response.status,status);
        assert.equal(response.headers.get("set-cookie"),null);
        assert.equal(response.headers.get("cache-control"),"no-store");
        assert.deepEqual(await response.json(),{error:"Authentication failed"});
      }
      delete process.env.ADMIN_TOKEN;
      assert.equal((await login(request('{"token":"x"}'))).status,503);
      process.env.ADMIN_TOKEN = "change-me";
      assert.equal((await login(request('{"token":"change-me"}'))).status,503);
      process.env.ADMIN_TOKEN = "ENDPOINT-PRIVATE-TOKEN";
      for(let i=0;i<2;i++) assert.equal((await login(request('{"token":"wrong"}'))).status,401);
      const limited = await login(request('{"token":"ENDPOINT-PRIVATE-TOKEN"}'));
      assert.equal(limited.status,429);
      assert.equal(limited.headers.get("retry-after"),"60");
      now += 60001;
      const ok = await login(request('{"token":"ENDPOINT-PRIVATE-TOKEN"}'));
      assert.equal(ok.status,200);
      const cookie = ok.headers.get("set-cookie");
      assert.match(cookie,/^__Host-admin-session=[a-f0-9]{64};/);
      for(const attribute of ["HttpOnly","Secure","SameSite=Strict","Path=/"])assert.ok(cookie.includes(attribute));
      assert.ok(!cookie.includes("Domain="));
      const cookieHeader = cookie.split(";")[0];
      const read = new Request("https://example.test/api/admin/auth/session",{headers:{cookie:cookieHeader}});
      const status = session(read);
      assert.deepEqual(Object.keys(await status.json()).sort(),["authenticated","expiresAt"]);
      assert.equal(assertAdmin(new Request("https://example.test/api/admin/review",{headers:{cookie:cookieHeader}})),null);
      const beforeEvents=events.length;
      session(read);
      assert.equal(events.length,beforeEvents);
      const out = await logout(request("",{cookie:cookieHeader}));
      assert.equal(out.status,200);
      assert.match(out.headers.get("set-cookie"),/Max-Age=0/);
      assert.equal(assertAdmin(new Request("https://example.test/api/admin/review",{headers:{cookie:cookieHeader}})).status,401);
      for(const secret of ["ENDPOINT-PRIVATE-TOKEN",cookieHeader.split("=")[1],"wrong"]) assert.ok(!events.join("").includes(secret));
      for(const action of ["auth_login_failed","auth_login_limited","auth_login","auth_logout","auth_session_invalid"]) assert.ok(events.some(event=>event.includes('"action":"'+action+'"')),action);
      process.stdout.write=write;
    })().catch(error=>{process.stdout.write=write;console.error(error);process.exitCode=1;});
  `], { encoding: "utf8", timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
});
