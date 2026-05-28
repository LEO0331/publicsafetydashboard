import { expect, test } from "@playwright/test";

test.describe("核心業務流程", () => {
  test("儀表板會從 SQLite 經 API 顯示統計、資料列，並套用違規篩選", async ({ page, request }) => {
    await page.goto("/");

    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("total-records")).toHaveText("3");
    await expect(page.getByTestId("announcement-count")).toHaveText("2");
    await expect(page.getByText("忠孝東路一段：2 筆")).toBeVisible();
    await expect(page.getByTestId("record-row")).toHaveCount(3);

    await page.getByTestId("filter-type").selectOption("酒駕");
    await page.getByTestId("filter-violation-count").selectOption("3+");
    await page.getByTestId("filter-location").fill("忠孝");
    await page.getByTestId("apply-filters").click();

    await expect(page.getByTestId("visible-record-count")).toHaveText("目前顯示 1 筆");
    await expect(page.getByTestId("record-row")).toHaveCount(1);
    const filteredRow = page.getByTestId("record-row").first();
    await expect(filteredRow).toContainText("陳小安");
    await expect(filteredRow).toContainText("第 4 次");
    await expect(filteredRow).toContainText("酒駕、無照");

    const records = await request.get("/api/records?type=酒駕&violationCount=3%2B&location=忠孝&pageSize=10");
    expect(records.ok()).toBeTruthy();
    const body = await records.json();
    expect(body.total).toBe(1);
    expect(body.rows[0].name).toBe("陳小安");
  });

  test("地圖資料以地點群組呈現，不以個人為單位", async ({ page, request }) => {
    const locations = await request.get("/api/locations");
    expect(locations.ok()).toBeTruthy();
    const body = await locations.json();
    const zhongxiao = body.find((item: { location: string }) => item.location === "忠孝東路一段");
    expect(zhongxiao.count).toBe(2);
    expect(zhongxiao.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "酒駕", count: 2 }),
        expect.objectContaining({ type: "無照", count: 1 }),
      ])
    );

    await page.goto("/");
    await page.getByTestId("map-tab").click();
    await expect(page.getByTestId("location-map")).toBeVisible();
  });

  test("匯入管理未提供正確權杖時會拒絕 PDF URL 匯入", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("admin-page")).toBeVisible();

    await page.getByTestId("admin-token").fill("wrong-token");
    await page.getByTestId("pdf-url-input").fill("https://example.test/announcement.pdf");
    await page.getByTestId("import-url-button").click();

    await expect(page.getByTestId("admin-result")).toContainText("Unauthorized");
  });

  test("匯入紀錄 API 未授權時不可讀取", async ({ request }) => {
    const logs = await request.get("/api/import/logs");
    expect(logs.status()).toBe(401);
  });
});
