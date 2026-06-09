# 架構

## 目的

本專案是一個 local-first 的教育儀表板，資料來源是臺北市政府公開酒駕、毒駕／藥駕、拒測累犯 PDF 公告。系統會收集公開 PDF 來源、解析表格資料、寫入 SQLite，並以統計、資料表、篩選與地圖方式呈現。

## Runtime 邊界

- `app/`：Next.js App Router 頁面與 API route handlers。
- `src/components/`：可重用的 client-side UI components。
- `src/components/uiLanguage.ts`：dashboard、admin、map 的雙語 copy、語言持久化與顯示格式化工具。
- `src/server/`：API routes 使用的 server-side SQLite query 與 admin helper。
- `src/db/`：Drizzle schema 與本機 SQLite client wiring。
- `scripts/`：Python 匯入、解析、爬取、geocoding 與維護腳本。
- `drizzle/`：SQLite migrations 與本機資料庫輸出。
- `e2e/`：Playwright browser tests 與 fixture database seeding。

技術選型原因請見：[技術選型與取捨](./tech-stack.zh-TW.md)。

## 資料流

1. `scripts/crawl_sources.py` 從臺北市交通局公告頁發現 PDF URLs。
2. `scripts/import_pdf.py` 下載或複製 PDF，計算穩定 content hash，並解析資料列。
3. `scripts/pdf_parser.py` 先使用 `pdfplumber` table extraction，再使用 text-row fallback。
4. 解析後的資料寫入 `src/db/schema.ts` 定義的 SQLite tables。
5. `app/api/*` route handlers 透過 `src/server/queries.ts` 讀取 SQLite。
6. Dashboard client components 呼叫 API routes，呈現 summary、filters、table rows 與 grouped map data。
7. Map tab 以 grouped ranked circles 搭配可搜尋 side list 顯示 geocoded locations，避免地圖上出現過多 pins。

## Database Tables

- `sources`：每一份來源公告/PDF 一列。
- `offender_records`：連到 `sources` 的解析違規資料列。
- `geocoded_locations`：依 normalized location query 快取 geocode 結果。

## API Surface

- `GET /api/stats`
- `GET /api/records`
- `GET /api/locations`
- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `POST /api/import/geocode`
- `GET /api/import/logs`

Admin import 與 logs endpoints 需要 `x-admin-token`。Token 必須透過 `ADMIN_TOKEN` 設定；placeholder `change-me` 會被拒絕。

## 隱私邊界

本 app 不使用其他來源補充 offender records。Geocoding 只送出地點文字，不送姓名或違規事實。預設不顯示照片。
