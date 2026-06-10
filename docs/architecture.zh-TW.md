# 架構、設計與取捨

## 目的

本專案是以臺北市政府公開酒駕、毒駕／藥駕與拒測累犯 PDF 公告為來源的 local-first 教育儀表板。系統會匯入公開 PDF、解析表格資料、寫入 SQLite，並以摘要、篩選、表格、CSV 匯出與地點群組地圖呈現，供交通安全教育使用。

## Runtime 邊界

```text
app/                    Next.js App Router 頁面與 API route handlers
src/components/         React UI components 與共用語言輔助工具
src/db/                 Drizzle schema 與 SQLite client wiring
src/server/             API routes 使用的 server-only query/admin helpers
scripts/                Python crawler、PDF parser、importer、geocoder 與 seed utilities
data/seed/              起始 parsed data 與 geocode cache；不包含照片
drizzle/migrations/     SQLite migrations
e2e/                    Playwright browser tests 與 fixture database seed
tests/                  Python unit tests 與 Node integration tests
docs/                   長期維護的架構、維運、harness 與 portfolio 文件
.github/workflows/      CI 與 Docker image publishing workflows
```

Root configuration files 保留在 repository root，因為工具會在根目錄尋找它們：`package.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.js`、`eslint.config.mjs`、`tsconfig.json`、`playwright.config.ts`、`lighthouserc.cjs`、`drizzle.config.ts`。Agent harness 相關檔案也保留在 root，方便重新接手：`AGENTS.md`、`feature_list.json`、`progress.md`、`session-handoff.md`、`init.sh`。

Generated local artifacts 例如 `.next/`、`node_modules/`、`test-results/`、`tsconfig.tsbuildinfo`、`.env`、`drizzle/dev.db` 已被 ignore，不應提交。

## 資料流

1. `scripts/crawl_sources.py` 從臺北市交通局列表頁探索 PDF URLs。
2. `scripts/import_pdf.py` 下載或複製 PDF、計算 content hash，並呼叫 parser。
3. `scripts/pdf_parser.py` 先用 `pdfplumber` 表格抽取，失敗時改用文字列重建 fallback。
4. Parsed rows 寫入由 `src/db/schema.ts` 與 Drizzle migrations 管理的 SQLite tables。
5. `app/api/*` route handlers 透過 `src/server/queries.ts` 查詢 SQLite。
6. Dashboard 顯示 summary cards、freshness warnings、filters、pagination records、CSV export 與 grouped map data。
7. 地圖只呈現 cached geocoded locations 的地點群組，不呈現個人層級 pin。

## 資料模型

- `sources`：每份公告/PDF 一列，包含 source URL、PDF URL、公告日期、content hash、parse status 與 hidden flag。
- `offender_records`：公告中的 parsed rows，包含違規日期、地點、違規事實、解析出的累犯次數/類型、酒精濃度、review flags 與 hidden flag。
- `geocoded_locations`：以 normalized Taipei location query 為 key 的 geocode cache。

## API Surface

公開 endpoints：

- `GET /api/stats`
- `GET /api/records?violationCount=&type=&location=&dateFrom=&dateTo=&page=&pageSize=`
- `GET /api/records/export.csv`
- `GET /api/locations`

Admin token endpoints：

- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `POST /api/import/geocode`
- `GET /api/import/logs`
- `GET /api/admin/review`
- `POST /api/admin/hide`

Admin routes 需要 `x-admin-token`。`ADMIN_TOKEN` 必須設定成強隨機值；placeholder `change-me` 會被拒絕。

## UI 設計

視覺方向是克制的 civic archive：公共紀錄感的 typography、ledger-like panels、中性的交通安全文字與高密度但可讀的 layout。繁體中文是預設介面語言，前端提供英文切換。公開公告中的資料值維持原文，不翻譯、不改寫。

Accessibility 與 safety rules：

- Root language 是 `zh-Hant`。
- Dashboard 有 skip link 與清楚 focus states。
- 人名搜尋不放在預設公開流程。
- 預設不顯示照片。
- Source attribution 與 public-data disclaimer 需要維持可見。

地圖刻意避免 pin wall。Map tab 使用 ranked searchable location explorer、scaled grouped circles、type breakdowns、date ranges，以及低排名地點的 show-all control。

## 技術選型

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js App Router、React、TypeScript | 一個 app 同時提供 UI、API routes 與 admin pages，資料 contract 清楚。 |
| Styling | Tailwind CSS | 快速建立 responsive UI，不引入大型 component framework。 |
| API | Next.js Route Handlers | Simple backend endpoints 靠近 dashboard，同時保留 server-only helpers。 |
| Database | SQLite | 適合小型公開資料集、local-first、簡單備份與低成本部署。 |
| Migrations | Drizzle Kit | 輕量 schema ownership 與 SQL migrations。 |
| Ingestion | Python scripts | Python PDF tooling 對不規則公告表格較可靠。 |
| PDF parsing | `pdfplumber` + text fallback | 先抽表格，失敗時保留 partial rows 供人工 review。 |
| Map | Leaflet + OpenStreetMap | 不需要 paid map APIs，也避免 vendor lock-in。 |
| Geocoding | Cached Nominatim maintenance step | 保護隱私，避免 page-load repeated geocoding。 |
| Testing | Python unittest、Node test runner、Playwright、Lighthouse CI | 覆蓋 parser、server queries、browser flows、accessibility 與 performance。 |
| Deployment | Docker full-stack service | Node、Python、SQLite、uploads、logs 與 migrations 需要在同一個 deployable unit 內。 |

## 替代方案與取捨

| Area | Current Choice | Alternative | Tradeoff |
| --- | --- | --- | --- |
| Frontend | Next.js | Vite SPA、Astro、Remix、SvelteKit | Next 可讓 UI 與 API 放一起；static SPA 仍需要 backend。 |
| API | Next route handlers | Express/Fastify/FastAPI | 現在 moving parts 較少；獨立 backend 未來會有更多控制權。 |
| Database | SQLite | Postgres/MySQL/static JSON | SQLite 簡單低成本；Postgres 較適合多人與持久 production writes。 |
| ORM | Drizzle | Prisma/raw SQL/Kysely | Drizzle 輕量且 migration-friendly；raw SQL 少了 typed schema ownership。 |
| PDF language | Python | JavaScript PDF libraries/OCR/manual CSV | Python 對 PDF tables 更實用；OCR 適合未來處理掃描文件。 |
| Geocoding | Cached Nominatim | Paid geocoder/local geocoder/manual CSV | 免費且符合 privacy，但會 rate limit；Render free 最適合使用 committed cache。 |
| Deployment | Docker service | GitHub Pages/Vercel/serverless | Static/serverless 不適合 SQLite writes、Python parsing、uploads 與 logs。 |
| Admin security | Single token | Full auth/OAuth/no admin UI | 單一 operator 足夠；多人管理時再升級為真實 authentication 與 audit logs。 |

## 系統層級取捨

系統優先考慮透明、低成本與教育用途，而不是 enterprise scaling。

- SQLite 讓維運簡單，但 production durability 需要 persistent storage。Render free 因 filesystem ephemeral，只適合 demo。
- 目前 schema 足以支援小型公開資料集與多年 local-first 使用。Dashboard 常用 filters 已針對 visible record date/count/location、source freshness 與 admin review queue 建立 indexes。
- Location map aggregation 先由 SQLite 依 `location_text` 聚合，再由 Node 計算違規類型 breakdown，避免資料成長時每筆 offender record 都進入記憶體 map loop。
- Python ingestion 提升解析可靠度，但增加雙語言 codebase；邊界限制在 `scripts/` 並用 tests 覆蓋。
- Import-time cached geocoding 避免 privacy 與 latency 問題，但地圖需要先 seed 或 generate coordinates。
- Public record display 需要謹慎 UX；本專案使用中性文字、grouped maps、source attribution、不預設人名搜尋、不顯示照片。
- Docker deployment 比 static hosting 大，但符合 full-stack app 的實際需求。

## Migration Paths

如果使用量成長，自然升級路徑是：

- SQLite 轉 Postgres，以支援持久 concurrent writes。
- Python scripts 轉 background worker queue，以處理長時間 imports。
- Admin token 轉 authenticated admin accounts 與 audit logs。
- Committed geocode seed 轉 managed cache backups。
- Render free 轉 Render persistent disk、Fly.io volume、Railway volume 或 VPS。

## Privacy Boundary

本 app 不從其他來源 enrich offender records、不爬社群、不推測地址，也不做臉部辨識。Geocoding 只送出 normalized location text，例如 `臺北市 {locationText}`。姓名與違規事實永遠不送到 geocoder。
