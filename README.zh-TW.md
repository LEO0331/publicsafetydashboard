# 臺北市酒駕／毒駕／拒測累犯教育儀表板

本專案是一個以臺北市政府公開 PDF 公告資料為來源的交通安全教育儀表板。系統可爬取公告頁、匯入 PDF、解析表格資料、寫入 SQLite，並透過 Next.js 儀表板呈現統計、篩選、資料表與地圖。

主要來源：
https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170

## 技術架構

- 前端：Next.js App Router、TypeScript、Tailwind CSS
- API：Next.js API Routes
- 資料庫：SQLite + Drizzle
- 匯入解析：Python、pdfplumber、PyMuPDF fallback dependency、pandas
- 地圖：Leaflet + OpenStreetMap
- 測試：Python unittest、Node test runner、Playwright、Lighthouse CI

## 本機設定

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run dev
```

開啟：

```text
http://localhost:3000
```

## 匯入資料

爬取臺北市交通局公告頁：

```bash
python3 scripts/crawl_sources.py
```

匯入單一 PDF 網址：

```bash
python3 scripts/import_pdf.py --url "<PDF_URL>"
```

匯入本機 PDF：

```bash
python3 scripts/import_pdf.py --file ./path/to/file.pdf
```

使用範例 PDF 種子資料：

```bash
python3 scripts/seed_example.py
```

地點快取 geocode：

```bash
python3 scripts/geocode_locations.py
```

重新建立全部資料：

```bash
python3 scripts/rebuild_all.py
```

## 管理介面

設定 `.env`：

```bash
ADMIN_TOKEN="<strong-secret>"
```

啟動後開啟：

```text
http://localhost:3000/admin
```

管理 API 和匯入紀錄都需要 `x-admin-token`。伺服器會拒絕未設定 token 或 `change-me` 這種預設值。

## 驗證

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run lighthouse:ci
npm run build
./init.sh
```

`npm run test:e2e` 會建立 deterministic SQLite 測試資料庫，啟動正式 Next.js build，並用 Playwright 驗證核心功能。

`npm run lighthouse:ci` 會檢查 `/` 與 `/admin` 的 Performance、Accessibility、Best Practices、SEO 分數門檻。

## CI/CD

GitHub Actions 已包含：

- `.github/workflows/ci.yml`：lint、typecheck、unit/integration test、Playwright e2e、Lighthouse CI。
- `.github/workflows/deploy.yml`：`main` 分支 CI 通過後建立 Docker image 並推送到 GitHub Container Registry，也可從 Actions 頁面手動執行。

部署說明請看：

- [部署指南](./docs/deployment.md)

## 隱私與安全規則

本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。

- 不使用其他來源補充個人資料。
- 不做臉部辨識。
- 不爬取社群媒體。
- 預設不顯示照片。
- Geocoding 只送出地點文字，不送姓名或違規事實。
- 地圖標記以地點群組呈現，不以個人為單位。
- 姓名搜尋不放在預設流程。

## 文件

- [Architecture](./docs/architecture.md)
- [Design](./docs/design.md)
- [Testing](./docs/testing.md)
- [Operations](./docs/operations.md)
- [Deployment](./docs/deployment.md)
- [Project Structure](./docs/project-structure.md)

## 已知限制

- PDF 表格格式可能隨公告不同而變化；解析不完整的列會以 `needsReview=true` 保留。
- 目前主要解析路徑是 `pdfplumber` 加文字 fallback。
- Nominatim geocoding 有速率限制，應在匯入或維護時執行，不在頁面載入時呼叫。
- 第一版以 local-first SQLite 為目標；雲端部署需配置持久化磁碟。
