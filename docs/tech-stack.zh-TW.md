# 技術選型與取捨

## 決策摘要

本專案刻意採用 local-first 與教育用途優先的架構。技術選型重視低維運複雜度、透明資料處理與可重現測試，而不是一開始就追求 enterprise-scale infrastructure。

## 目前選擇

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js App Router + React + TypeScript | 同一個 app 可以服務 dashboard、admin UI 與 API routes。TypeScript 讓資料 contracts 更明確。 |
| Styling | Tailwind CSS | 可快速建立一致、responsive 的 UI，不需要引入大型 component framework。 |
| API | Next.js Route Handlers | 讓簡單 app endpoints 靠近 frontend，同時仍可執行 server-side SQLite 與 admin actions。 |
| Database | SQLite | 適合 local-first、小型公開 datasets、簡單備份與低成本 Render/Fly/VPS operation。 |
| Migrations | Drizzle Kit | 提供 typed schema ownership 與 SQL migrations，不需要獨立 database server。 |
| PDF ingestion | Python scripts | Python 有較成熟的 PDF table tooling，也比較容易 debug document extraction。 |
| PDF parser | `pdfplumber` first, text fallback | 先嘗試 table extraction；PDF layout 變動時，用 text fallback 保留 partial records 供 review。 |
| Map | Leaflet + OpenStreetMap tiles | 避免 paid map APIs，符合 public-interest education use case。 |
| Geocoding | Nominatim with cache | 免費/open geocoding 只適合 import-time maintenance step，必須 rate limit 並保存結果。 |
| Testing | Python unittest, Node test runner, Playwright, Lighthouse CI | 覆蓋 ingestion logic、API filters、browser flows、accessibility 與 performance，不需要重型測試基礎設施。 |
| Deployment | Docker + GitHub Actions + Render-compatible startup | App 需要 Node、Python、SQLite、本機檔案與 migrations，因此 containerized full-stack service 是最簡單的 deployable unit。 |

## 替代方案與取捨

| Area | Current Choice | Alternatives Considered | Tradeoff |
| --- | --- | --- | --- |
| Frontend framework | Next.js App Router | Vite SPA、Astro、SvelteKit、Remix | Next.js 可把 API routes 與 UI 放在同一個 deployable app。Vite SPA 靜態 UI 更簡單，但仍需要另一個 backend。Astro 適合內容站，但 admin/API workflows 不如 Next 自然。Remix/SvelteKit 可行，但對此小型專案的額外價值低於使用 Next 生態系。 |
| API layer | Next.js Route Handlers | Express/Fastify、Python FastAPI、serverless functions | Route Handlers 減少 moving parts。Express/Fastify 提供更多 backend control，但多一個 server boundary。FastAPI 與 ingestion scripts 同語言，但會把 TypeScript frontend 與 Python API 分成兩個 services。Serverless functions 不適合 local-file SQLite 與 Python PDF parsing。 |
| Database | SQLite | Postgres、MySQL、managed document DB、static JSON only | SQLite 便宜、透明，足以支援小型教育 dataset。Postgres 對 concurrent writes、durable cloud hosting、多 admins 更好，但增加成本與維運。Static JSON 最容易 host，但無法支援 admin imports、review flags、geocode-cache updates。 |
| ORM/migrations | Drizzle | Prisma、raw SQL only、Kysely | Drizzle 提供低負擔 schema ownership 與 migrations。Prisma 完整但較重，對 local-first SQLite app 有較多不必要 moving parts。Raw SQL 簡單但少了 typed schema 文件化。Kysely 適合 typed queries，但 migration ownership 不如 Drizzle 直接。 |
| PDF parsing language | Python | JavaScript PDF libraries、manual CSV entry、OCR pipeline | Python 對 messy PDF tables 的實用工具較強。JavaScript 可減少語言數量，但在此 parsing use case 較弱。Manual CSV 可靠但違背 crawler/import 目標。OCR 可支援掃描文件，但複雜度與 accuracy risk 高，應放在未來。 |
| PDF parser | `pdfplumber` + text fallback | Camelot/Tabula、PyMuPDF-only、OCR | `pdfplumber` 對 text-based tables 實用且易測。Camelot/Tabula 可能很強，但需要額外 system dependencies。PyMuPDF 可作 fallback，但不是 table-focused。OCR 只有在公告變成 scanned images 時才值得考慮。 |
| Mapping | Leaflet + OSM tiles | Google Maps、Mapbox、no map、server-rendered static map | Leaflet/OSM 避免 paid APIs 與 vendor lock-in。Google/Mapbox 提供更完整 geocoding/tiles，但有成本、keys、policy constraints。No map 更簡單但教育效果較弱。Static maps 很快但互動性較低。 |
| Geocoding | Nominatim cached during import | Paid geocoder、local geocoder、manual coordinate CSV | Nominatim 免費/open，但 rate-limited，且 shared cloud IP 不穩。Paid geocoders 更可靠，但不符合低成本目標。Local geocoder 太重。Manual/local exported cache 是免費部署時最佳 fallback。 |
| Deployment | Docker full-stack service | GitHub Pages、Vercel、separate frontend/backend、managed Kubernetes | Docker 符合 Node + Python + SQLite 形狀。GitHub Pages 無法跑 backend。Vercel 很適合許多 Next apps，但不適合這種 local-file SQLite/Python ingestion 模型。Separate services 或 Kubernetes 對第一版過度設計。 |
| Admin security | Single `ADMIN_TOKEN` | Full user login、OAuth、no admin UI | 單一 token 足以支援單人操作的教育 demo。完整 auth 對多人管理與 audit trails 更好，但增加 account/security surface。沒有 admin UI 會迫使 command-line operation，hosted demo 較難維護。 |
| Test stack | Built-in Python/Node tests + Playwright + Lighthouse | Jest/Vitest、Cypress、no browser tests | Built-in runners 減少依賴，同時覆蓋核心 logic。Playwright 驗證真實 browser/API/database behavior。Jest/Vitest 未來可用於複雜 frontend unit tests。Cypress 可行，但不如目前 CI/browser tooling 一致。 |

## 為什麼不是 Static Site

Dashboard 不只是靜態內容，它需要：

- Filters、stats、locations 與 admin import actions 的 API routes。
- SQLite reads/writes。
- Python PDF parsing。
- Upload handling。
- Import logs。
- Admin-token protected operations。

GitHub Pages 或 static CDN 無法執行這些 server-side responsibilities。

## 為什麼選 SQLite

SQLite 適合第一版，原因是：

- Dataset 小，主要是在 imports 時 append/update。
- App 是 local-first，學生或教師容易本機執行。
- 備份簡單：複製一個 database file 加 seed JSON files。
- 部署成本低。

Production 中 SQLite 應放在 persistent storage。Render free 沒有 persistent disks，因此只適合 demo。若要 durable hosting，請 mount persistent storage 到 `/app/drizzle`，或未來移到 managed database。

## 為什麼 Ingestion 用 Python

PDF table parsing 是本專案風險最高的部分。選 Python 是因為：

- `pdfplumber` 對 table extraction 與 layout inspection 實用。
- Parser logic 可獨立於 web app 測試。
- Ingestion 可作為 maintenance/admin action，而不是每次 page load 都執行。
- Geocoding 與 PDF parsing 不會進入 user-facing request path。

## 為什麼使用 Cached Geocoding

隱私與可靠性要求排除 page-load geocoding：

- Geocoder requests 只能包含 location text。
- 不得送出姓名與違規事實。
- Nominatim 有 rate limit，不適合重複由 UI 觸發。
- Cached coordinates 讓 map 快速且可重現。

Render free 建議本機 geocoding 加 `data/seed/geocoded_locations.json`，因為 shared cloud IP 可能收到 `429 Too many requests`。

## 為什麼 Admin Token 足夠第一版

公開 dashboard 不需要 login。Admin import actions 使用簡單 `ADMIN_TOKEN`，因為第一版只有單一 operator，沒有 account model。如果未來需要多個 admins 或 audit trails，再替換成真正的 authentication 與 role-based authorization。

## Migration Paths

若使用量成長，建議升級路徑：

- SQLite 轉 Postgres，以支援 durable multi-user writes。
- Python scripts 轉 background worker queue，以支援長時間 imports。
- Admin token 轉 authenticated admin accounts。
- JSON geocode seed 轉 managed geocode-cache table backups。
- Render free demo 轉 Render paid disk、Fly.io volume、Railway volume 或 VPS。
