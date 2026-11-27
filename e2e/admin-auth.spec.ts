import { expect, test } from "@playwright/test";
import { adminOrigin, csrfHeaders, loginApi, loginPage } from "./fixtures/admin-auth";

test("explicit login clears credentials, survives refresh, and logout discards delayed protected data", async ({ page, context }) => {
  const protectedRequests: string[] = [];
  page.on("request", request => {
    if (/\/api\/(admin\/review|import\/logs|admin\/security)/.test(request.url())) protectedRequests.push(request.url());
  });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-token")).toBeVisible();
  await page.getByTestId("admin-token").pressSequentially("e2e-secret");
  expect(protectedRequests).toEqual([]);
  await loginPage(page);
  await expect(page.getByTestId("admin-review-rows")).toContainText("李小美");
  const cookies = await context.cookies();
  const session = cookies.find(cookie => cookie.name === "admin-session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain("e2e-secret");
  expect(await page.evaluate(() => document.cookie)).not.toContain(session!.value);
  await page.reload();
  await expect(page.getByTestId("admin-logout")).toBeVisible();
  await expect(page.getByTestId("admin-token")).toHaveCount(0);
  await page.getByTestId("security-load").click();
  await expect(page.getByTestId("security-report")).toBeVisible();
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/admin/review", async route => {
    await delayed;
    await route.fulfill({ json: { reviewItems: [{ id: 999, name: "STALE-PRIVATE-ROW", source_title: "stale" }], sources: [] } }).catch(() => {});
  });
  const requested = page.waitForRequest("**/api/admin/review");
  await page.reload();
  await requested;
  await expect(page.getByTestId("admin-logout")).toBeVisible();
  await page.getByTestId("admin-logout").click();
  await expect(page.getByTestId("admin-token")).toBeVisible();
  release();
  await expect(page.getByTestId("admin-review-rows")).toHaveCount(0);
  await expect(page.getByTestId("security-report")).toHaveCount(0);
  expect((await page.request.get("/api/admin/review")).status()).toBe(401);
  const copiedCookie = `${session!.name}=${session!.value}`;
  expect((await page.request.get("/api/admin/review", { headers: { cookie: copiedCookie } })).status()).toBe(401);
});

test("expired session responses clear protected UI in English and mobile layouts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page.getByTestId("admin-language-en").click();
  await loginPage(page);
  await expect(page.getByTestId("admin-review-rows")).toContainText("李小美");
  await page.getByTestId("security-load").click();
  await expect(page.getByTestId("security-report")).toBeVisible();
  await page.route("**/api/admin/security", route => route.fulfill({ status: 401, json: { error: "Unauthorized" } }));
  await page.getByTestId("security-load").click();
  await expect(page.getByTestId("admin-token")).toBeVisible();
  await expect(page.getByTestId("admin-review-rows")).toHaveCount(0);
  await expect(page.getByTestId("security-report")).toHaveCount(0);
  await expect(page.getByTestId("import-url-button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("all administrative routes require sessions and all mutations reject foreign origins", async ({ request }) => {
  for (const path of ["/api/admin/review", "/api/import/logs", "/api/admin/security", "/api/admin/security?format=csv", "/api/admin/security?format=jsonl"]) {
    expect((await request.get(path)).status(), path).toBe(401);
    expect((await request.get(path, { headers: { "x-admin-token": "e2e-secret" } })).status(), path).toBe(401);
  }
  for (const path of ["/api/admin/hide", "/api/import/pdf-url", "/api/import/pdf-file", "/api/import/crawl", "/api/import/geocode", "/api/admin/security"]) {
    expect((await request.post(path, { headers: csrfHeaders, data: {} })).status(), path).toBe(401);
  }
  expect((await request.post("/api/admin/auth/login", { headers: { origin: "https://foreign.test", "x-admin-csrf": "1" }, data: { token: "e2e-secret" } })).status()).toBe(403);
  await loginApi(request);
  for (const path of ["/api/admin/hide", "/api/import/pdf-url", "/api/import/pdf-file", "/api/import/crawl", "/api/import/geocode", "/api/admin/security", "/api/admin/auth/logout"]) {
    const response = await request.post(path, { headers: { ...csrfHeaders, origin: "https://foreign.test", "x-forwarded-host": "foreign.test" }, data: {} });
    expect(response.status(), path).toBe(403);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  }
  const status = await request.get("/api/admin/auth/session");
  expect(status.headers()["cache-control"]).toContain("no-store");
  const body = await status.json();
  expect(body.authenticated).toBe(true);
  expect(Object.keys(body).every(key => ["authenticated", "expiresAt"].includes(key))).toBe(true);
  expect(JSON.stringify(body)).not.toContain("e2e-secret");
  expect((await request.post("/api/admin/auth/logout", { headers: { ...csrfHeaders, origin: adminOrigin } })).ok()).toBe(true);
  expect((await request.get("/api/admin/review")).status()).toBe(401);
});

test("a confirmed session deadline clears protected data when the status endpoint becomes unreachable", async ({ page }) => {
  let statusCalls = 0;
  await page.route("**/api/admin/auth/session", route => {
    statusCalls++;
    if (statusCalls === 1) return route.fulfill({ json: { authenticated: true, expiresAt: Date.now() + 2000 } });
    return route.abort("failed");
  });
  await page.route("**/api/import/logs", route => route.fulfill({ json: { logs: ["DEADLINE-PRIVATE-LOG"] } }));
  await page.route("**/api/admin/review", route => route.fulfill({ json: { reviewItems: [{ id: 999, name: "DEADLINE-PRIVATE-ROW", source_title: "fixture" }], sources: [] } }));
  await page.goto("/admin");
  await expect(page.getByTestId("admin-logout")).toBeVisible();
  await expect(page.getByTestId("admin-review-rows")).toContainText("DEADLINE-PRIVATE-ROW");
  await expect(page.getByTestId("admin-token")).toBeVisible();
  await expect(page.getByTestId("admin-review-rows")).toHaveCount(0);
  await expect(page.getByText("DEADLINE-PRIVATE-LOG")).toHaveCount(0);
  expect(statusCalls).toBeGreaterThan(1);
});
