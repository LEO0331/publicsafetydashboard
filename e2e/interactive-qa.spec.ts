import { expect, test } from "@playwright/test";

test.describe("互動式 QA 檢查", () => {
  test("桌面首屏主要區塊可見且沒有頁面級水平溢出", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "臺北市酒駕／毒駕／拒測累犯教育儀表板" })).toBeVisible();
    await expect(page.getByTestId("total-records")).toHaveText("3");
    await expect(page.getByTestId("filter-violation-count")).toBeVisible();

    const fit = await page.evaluate(() => ({
      canScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroBottom: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
      filtersTop: document.querySelector("[data-testid='filter-violation-count']")?.getBoundingClientRect().top ?? 0,
      viewportHeight: window.innerHeight,
    }));
    expect(fit.canScrollX).toBe(false);
    expect(fit.heroBottom).toBeLessThan(fit.viewportHeight);
    expect(fit.filtersTop).toBeLessThan(fit.viewportHeight);
  });

  test("行動版篩選與空狀態不造成頁面級水平溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("total-records")).toHaveText("3");

    await page.getByTestId("filter-location").fill("不存在路名");
    await page.getByTestId("apply-filters").click();

    await expect(page.getByText("尚無符合條件的公告資料")).toBeVisible();
    const canScrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(canScrollX).toBe(false);
  });

  test("英文介面切換保留資料與篩選功能", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("language-en").click();
    await expect(page.getByRole("heading", { name: /Taipei Repeat DUI/ })).toBeVisible();
    await expect(page.getByTestId("visible-record-count")).toHaveText("Showing 3 of 3 records, page 1 of 1");
    await expect(page.getByTestId("records-prev-page")).toBeDisabled();
    await expect(page.getByTestId("records-next-page")).toBeDisabled();
    await expect(page.getByText("Drunk driving").first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /Taipei Repeat DUI/ })).toBeVisible();

    await page.getByTestId("filter-location").fill("不存在路名");
    await page.getByTestId("apply-filters").click();

    await expect(page.getByText("No matching announcement records")).toBeVisible();
  });

  test("匯入管理頁可切換英文介面", async ({ page }) => {
    await page.goto("/admin");

    await page.getByTestId("admin-language-en").click();

    await expect(page.getByRole("heading", { name: "Import Admin" })).toBeVisible();
    await expect(page.getByText("Government Page Crawl")).toBeVisible();
    await expect(page.getByPlaceholder("Enter ADMIN_TOKEN")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Taipei Repeat DUI/ })).toBeVisible();
  });
});
