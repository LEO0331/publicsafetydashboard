# Resume Deep Dive 準備

## 一句話專案介紹

建置一個雙語 full-stack 教育儀表板，可匯入臺北市政府公開累犯 PDF 公告、解析到 SQLite，並用 filters、stats 與 grouped maps 視覺化交通安全模式。

## Resume Bullets

- Built a Next.js/TypeScript public-safety dashboard with SQLite-backed APIs, bilingual UI, filterable records, summary statistics, and Leaflet/OpenStreetMap location visualization.
- Implemented Python PDF ingestion pipeline with crawler, one-PDF importer, `pdfplumber` table extraction, text fallback, parser confidence, and manual-review flags.
- Designed privacy-preserving geocoding flow that sends only location text, caches coordinates, handles Nominatim rate limits, and supports local cache export for Render free deployments.
- Added CI quality gates with lint, typecheck, Python/Node tests, coverage enforcement, Playwright e2e flows, Lighthouse audits, and Docker image publishing.
- Documented architecture, tech-stack tradeoffs, incident response, deployment workflow, and bilingual public-facing usage guides.

## 架構講解重點

- 一個 deployable Next.js app 負責 public UI、admin UI 與 API endpoints。
- Python 只負責 ingestion scripts，因為 PDF parsing 在 Python ecosystem 更可靠。
- SQLite 讓專案 local-first 且低成本，適合教育用途。
- Geocoding 只在 import-time 執行、只送 location text，並快取結果。
- Map 依地點 group，不依個人呈現，避免 people-tracking 行為。
- Admin 使用簡單 environment token，因為第一版只有單一 operator，沒有 account system。

## Deep-Dive Questions And Strong Answers

### 為什麼不是 static site？

因為專案需要 server-side imports、SQLite queries、upload handling、logs 與 admin endpoints。Static site 可以顯示預先產生的 JSON，但會失去 import/admin workflows 與 geocode cache updates。

### 為什麼 SQLite 而不是 Postgres？

SQLite 符合第一版 constraints：small dataset、local-first setup、簡單 backup、低成本。Tradeoff 是 cloud hosts 上的 durability 與 concurrency。若要 serious multi-user production，文件化 migration path 是 Postgres。

### 為什麼 Next.js 專案裡使用 Python？

PDF table parsing 是最高風險部分。Python 有成熟工具如 `pdfplumber`，且 scripts 被隔離在 CLI/admin actions 後面，runtime boundary 清楚且可測。

### 如何處理 privacy risk？

App 不 enrichment records、不 scrape social media、不推論 identities、不預設顯示照片。Geocoding 只送 location text。Map 依 place group 而非 person。UI 使用中性教育文字，且不把姓名搜尋放在預設流程。

### 真實 production issue 是什麼？

Nominatim 從 Render shared IP 回 HTTP 429。修正方式是第一個 429 後停止 batch、下次重試 failed rows、預設小批次慢速執行，並加入 local geocode export/import cache 供 Render free deployment 使用。

### 怎麼知道系統有效？

專案有 Python unit tests 覆蓋 parser/geocoder/seed behavior、Node integration tests 覆蓋 API query/admin auth、Playwright e2e 覆蓋 dashboard/admin/map flows、80% 以上 coverage gates，以及 Lighthouse CI 驗證 performance/accessibility/SEO。

### 下一步會改善什麼？

Serious production 改用 persistent disk 或 Postgres；多 admins 時加入完整 authentication；增加更多真實 PDF parser fixtures；長時間 imports/geocoding 移到 background worker queue。

## System Design Diagram

```text
Taipei DOT source page / PDF URL / local PDF
        |
        v
Python crawler/importer/parser scripts
        |
        v
SQLite tables: sources, offender_records, geocoded_locations
        |
        v
Next.js API routes: stats, records, locations, import/admin
        |
        v
Bilingual dashboard: summaries, filters, table, grouped map
```

## 最重要的 Tradeoff

這不是過度設計的 enterprise system，而是刻意 scoped 為教育用途、local-first、privacy-boundary 清楚的 data product。最值得強調的工程決策在於邊界：server vs ingestion scripts、import-time geocoding vs page-load geocoding、grouped map vs individual pins、以及低成本部署用的 seed/cache workflows。
