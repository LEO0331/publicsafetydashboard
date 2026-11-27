import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const adminOrigin = "http://127.0.0.1:3100";
export const csrfHeaders = { origin: adminOrigin, "x-admin-csrf": "1" };

export async function loginApi(request: APIRequestContext) {
  const response = await request.post("/api/admin/auth/login", {
    headers: csrfHeaders, data: { token: "e2e-secret" },
  });
  expect(response.status()).toBe(200);
  return response;
}

export async function loginPage(page: Page) {
  await page.getByTestId("admin-token").fill("e2e-secret");
  await page.getByTestId("admin-login").click();
  await expect(page.getByTestId("admin-logout")).toBeVisible();
  await expect(page.getByTestId("admin-token")).toHaveCount(0);
}
