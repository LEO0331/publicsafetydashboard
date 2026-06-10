import { expect, test } from "@playwright/test";

test.describe("核心業務流程", () => {
  test("儀表板會從 SQLite 經 API 顯示統計、資料列，並套用違規篩選", async ({ page, request }) => {
    await page.goto("/");

    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("total-records")).toHaveText("3");
    await expect(page.getByTestId("announcement-count")).toHaveText("2");
    await expect(page.getByText("忠孝東路一段：2 筆")).toBeVisible();
    await expect(page.getByTestId("record-row")).toHaveCount(3);
    await expect(page.getByTestId("visible-record-count")).toHaveText("目前顯示 3 / 3 筆，第 1 / 1 頁");
    await expect(page.getByTestId("data-freshness")).toContainText("待人工檢查");
    await expect(page.getByTestId("needs-review-count")).toHaveText("1");
    await expect(page.getByTestId("records-prev-page")).toBeDisabled();
    await expect(page.getByTestId("records-next-page")).toBeDisabled();

    await page.getByTestId("filter-type").selectOption("酒駕");
    await page.getByTestId("filter-violation-count").selectOption("3+");
    await page.getByTestId("filter-location").fill("忠孝");
    await page.getByTestId("apply-filters").click();

    await expect(page.getByTestId("visible-record-count")).toHaveText("目前顯示 1 / 1 筆，第 1 / 1 頁");
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

    const csv = await request.get("/api/records/export.csv?type=酒駕");
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const csvBody = await csv.text();
    expect(csvBody).toContain('"name","violation_date"');
    expect(csvBody).toContain("王小明");
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
    await expect(page.getByTestId("map-legend")).toContainText("圓點代表地點群組");
    await expect(page.getByText("地點清單")).toBeVisible();
    await page.getByTestId("map-location-search").fill("忠孝");
    await expect(page.getByRole("button", { name: /忠孝東路一段/ })).toBeVisible();
  });

  test("匯入管理未提供正確權杖時會拒絕 PDF URL 匯入", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("admin-page")).toBeVisible();

    await page.getByTestId("admin-token").fill("wrong-token");
    await page.getByTestId("pdf-url-input").fill("https://example.test/announcement.pdf");
    await page.getByTestId("import-url-button").click();

    await expect(page.getByTestId("admin-result")).toContainText("Unauthorized");

    await expect(page.getByText("地圖座標產生")).toBeVisible();
    await page.getByTestId("geocode-button").click();
    await expect(page.getByTestId("admin-result")).toContainText("Unauthorized");
  });

  test("匯入紀錄 API 未授權時不可讀取", async ({ request }) => {
    const logs = await request.get("/api/import/logs");
    expect(logs.status()).toBe(401);
  });

  test("管理端可讀取待檢查資料並可 reversibly hide record/source", async ({ request }) => {
    const unauthorized = await request.get("/api/admin/review");
    expect(unauthorized.status()).toBe(401);

    const review = await request.get("/api/admin/review", { headers: { "x-admin-token": "e2e-secret" } });
    expect(review.ok()).toBeTruthy();
    const body = await review.json();
    expect(body.reviewItems.length).toBe(1);
    expect(body.sources.length).toBe(2);

    const recordId = body.reviewItems[0].id;
    const sourceId = body.sources[0].id;
    const hideRecord = await request.post("/api/admin/hide", {
      headers: { "x-admin-token": "e2e-secret" },
      data: { target: "record", id: recordId, hidden: true },
    });
    expect(hideRecord.ok()).toBeTruthy();
    const afterRecordHide = await request.get("/api/stats");
    expect((await afterRecordHide.json()).needsReview).toBe(0);

    const unhideRecord = await request.post("/api/admin/hide", {
      headers: { "x-admin-token": "e2e-secret" },
      data: { target: "record", id: recordId, hidden: false },
    });
    expect(unhideRecord.ok()).toBeTruthy();

    const hideSource = await request.post("/api/admin/hide", {
      headers: { "x-admin-token": "e2e-secret" },
      data: { target: "source", id: sourceId, hidden: true },
    });
    expect(hideSource.ok()).toBeTruthy();
    const unhideSource = await request.post("/api/admin/hide", {
      headers: { "x-admin-token": "e2e-secret" },
      data: { target: "source", id: sourceId, hidden: false },
    });
    expect(unhideSource.ok()).toBeTruthy();
  });
});
