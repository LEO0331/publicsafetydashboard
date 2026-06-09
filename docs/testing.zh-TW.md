# 測試

## 層級

1. Unit tests：Python PDF parser、crawler extraction、violation parsing、geocoder privacy、geocode-cache behavior、bundled starter-data seeding。
2. Integration tests：SQLite/API query behavior，以及透過 server helpers 驗證 admin token enforcement。
3. End-to-end tests：Playwright 測試 dashboard、map、filter、admin auth flows。
4. Lighthouse CI：對 `/` 與 `/admin` 執行 Performance、Accessibility、Best Practices、SEO gates。

## 指令

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run lighthouse:ci
npm run build
./init.sh
```

## Coverage Gates

`npm run test:coverage` 不引入第三方 test runner，針對專案核心程式碼執行 coverage gate：

- Python ingestion modules tracked：`scripts/common.py`、`scripts/crawl_sources.py`、`scripts/geocode_locations.py`、`scripts/pdf_parser.py`、`scripts/export_geocode_cache.py`、`scripts/seed_initial_data.py`、`scripts/seed_geocode_cache.py`。
- Python line coverage threshold：80%。
- Node server integration coverage threshold：80%。

目前本機 baseline：

```text
Python tracked modules: 83.23% line coverage
Node integration/server code: 97.76% line coverage
```

## Test Data

`e2e/fixtures/seed-e2e-db.mjs` 會建立 `drizzle/e2e.db`，包含 deterministic announcement、record、geocoded-location data。E2E 與 Lighthouse 使用這個 fixture，因此 CI 不依賴 live Taipei DOT pages 或 Nominatim。

`data/seed/initial_announcements.json` 包含從兩份臺北市交通局公開 PDF 解析出的 deployable starter dataset。Unit tests 驗證該 seed 會插入 2 sources 與 50 records，且不包含 bundled photos。

## E2E Coverage

- Dashboard 透過 API routes 從 SQLite 載入資料。
- Stats 與 announcement counts 正確呈現。
- Violation type/count/location filters 會更新 visible records。
- Location data 依地點 group。
- Map tab 會呈現 ranked/searchable location explorer。
- English interface toggle 會在 reload 與 dashboard/admin navigation 後持續保存。
- Admin import 會拒絕 invalid tokens。
- Desktop 與 mobile viewport checks 防止 page-level horizontal overflow。

## CI

`.github/workflows/ci.yml` 執行 dependency installation、lint、typecheck、unit/integration tests、coverage gates、Playwright e2e 與 Lighthouse CI。
