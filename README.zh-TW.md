# 臺北市酒駕／毒駕／拒測累犯教育儀表板

這是一個以臺北市政府公開 PDF 公告為資料來源的雙語交通安全教育儀表板。專案目標是協助學生、教師與一般讀者，以資料視覺化方式理解酒駕、毒駕／藥駕、拒測等累犯公告資料的型態、時間與地點分布。

線上示範：

https://publicsafetydashboard.onrender.com

主要公開來源：

https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170

English README:

[README.md](./README.md)

## 這個專案做什麼

- 從臺北市交通局公告頁、PDF 網址或本機 PDF 匯入公開公告資料。
- 解析 PDF 表格，將公告列資料寫入本機 SQLite。
- 顯示公告總筆數、已匯入公告數、累犯次數分布、違規類型分布與高頻地點。
- 顯示資料更新狀態與待人工檢查資料列數。
- 支援依違規類型、累犯次數、日期範圍與地點關鍵字篩選。
- 可將目前篩選後的公開表格資料匯出為 CSV。
- 前端支援繁體中文與英文切換。
- 地圖以「地點群組」呈現，不以個人為單位呈現。
- Geocoding 僅使用快取資料；頁面載入時不呼叫 geocoder。
- 管理頁提供匯入紀錄、待檢查資料列，以及可復原的 source/record 隱藏功能。

## 公共安全與隱私聲明

本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。

本專案刻意避免把公開公告做成人名搜尋或個人追蹤工具：

- 不使用其他來源補充個人資料。
- 不爬取社群媒體。
- 不做臉部辨識。
- 預設不顯示照片。
- Geocoding 只送出地點文字，不送姓名或違規事實。
- 地圖點位依地點群組呈現。
- 公開公告中的姓名、地點、PDF 標題與來源內容會依原文保留，不翻譯、不改寫。

## 快速開始

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run seed:initial
npm run dev
```

開啟：

```text
http://localhost:3000
```

管理頁：

```text
http://localhost:3000/admin
```

使用匯入功能前，請設定非預設管理權杖：

```bash
ADMIN_TOKEN="<strong-secret>"
```

## 匯入資料

匯入內建起始資料，來源為 PageSize=105 列表中 91 份符合格式的臺北市交通局公開公告：

```bash
npm run seed:initial
```

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

## 地圖座標

內建起始資料已包含部分 starter locations 的本機 demo geocode cache，因此部署後的 demo map 可以直接顯示 grouped location circles，不需要從 Render 呼叫 Nominatim。新增匯入或新增 seed 的地點可之後從 `/admin` 或 `scripts/geocode_locations.py` 產生座標。

地圖使用 `geocoded_locations` 中的快取座標。匯入 PDF 後只會產生資料列，不會自動產生經緯度。

本機 geocoding：

```bash
python3 scripts/geocode_locations.py --limit 5 --delay 10
```

Render free 部署建議使用本機 geocoding，然後匯出快取：

```bash
npm run export:geocode
git add data/seed/geocoded_locations.json
git commit -m "Seed geocoded map locations"
git push
```

Render 啟動時會自動執行 `scripts/seed_geocode_cache.py` 匯入快取座標，避免從 Render shared IP 呼叫 Nominatim。

## 技術架構

- 前端：Next.js App Router、React、TypeScript、Tailwind CSS。
- 後端/API：Next.js Route Handlers。
- 資料庫：SQLite + Drizzle migrations。
- 匯入解析：Python scripts、`pdfplumber`、文字 fallback。
- 地圖：Leaflet、React Leaflet、OpenStreetMap tiles。
- 測試：Python `unittest`、Node test runner、Playwright、Lighthouse CI。
- 部署：GitHub Actions 發布 Docker image，Render-compatible startup script。

技術選型原因請見：[架構、設計與取捨](./docs/architecture.zh-TW.md)。

## 文件

- [架構、設計與取捨](./docs/architecture.zh-TW.md)
- [維運、部署、測試與 Incident Response](./docs/operations.zh-TW.md)
- [Agent Harness](./docs/agent-harness.zh-TW.md)
- [Resume Deep Dive 準備](./docs/resume-deep-dive.zh-TW.md)
- [繁體中文文件索引](./docs/README.zh-TW.md)

## API 端點

- `GET /api/stats`
- `GET /api/records?violationCount=&type=&location=&dateFrom=&dateTo=&page=&pageSize=`
- `GET /api/locations`
- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `POST /api/import/geocode`
- `GET /api/import/logs`

管理匯入端點需要 `x-admin-token`。

## 驗證

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

## 部署注意事項

完整系統需要 Next.js API routes、SQLite、Python PDF 解析、上傳檔案、log 與管理端點，因此應以 Docker/Node service 部署，不是純靜態網站。

建議的持久化部署方式：

- Render paid web service + persistent disk。
- Fly.io volume。
- Railway 或 VPS persistent filesystem。

Render free 可做展示，但 SQLite 資料與上傳檔案可能在重啟或重新部署後消失。

## 已知限制

- PDF 版面可能變動；解析不完整的資料列會以 `needsReview=true` 保留。
- Nominatim 可能限制雲端服務商 IP；部署時建議使用本機 geocoding 快取。
- SQLite 是 local-first 選擇；若未來需要多人長期使用，可評估 Postgres 或其他 managed database。
