# 維運、部署、測試與 Incident Response

## 本機設定

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run seed:initial
npm run dev
```

Dashboard 開在 `http://localhost:3000`，管理頁開在 `http://localhost:3000/admin`。

使用匯入功能前，請設定非預設 admin token：

```bash
ADMIN_TOKEN="<strong-secret>"
```

`ADMIN_TOKEN=change-me` 會被系統拒絕。

## 匯入與維護指令

```bash
python3 scripts/crawl_sources.py
python3 scripts/import_pdf.py --url "<PDF_URL>"
python3 scripts/import_pdf.py --file ./path/to/file.pdf
python3 scripts/geocode_locations.py --limit 5 --delay 10
python3 scripts/export_geocode_cache.py
python3 scripts/seed_geocode_cache.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
npm run seed:initial
npm run export:geocode
npm run seed:geocode
```

`npm run seed:initial` 會匯入由 115.04.22 與 115.05.27 臺北市交通局公開 PDF 公告解析出的 starter dataset。它只保存 parsed rows，不 bundled 原始 PDF binaries 或照片。

`npm run seed:geocode` 會匯入 `data/seed/geocoded_locations.json`。Committed seed 內含 starter locations 的近似 demo coordinates，讓 public demo map 部署後即可使用。

## Admin Operations

`/admin` 頁支援：

- 爬取臺北市交通局公告。
- 匯入 PDF URL。
- 上傳本機 PDF。
- 產生 cached map coordinates。
- 查看 parser/import logs。
- 查看 `needsReview` rows。
- 當 source 被修正或移除時，hide/unhide sources 或 records。

Hide actions 只更新 flags，不刪除 rows，以保留 auditability。

## CSV 匯出

Dashboard CSV export 使用與 `/api/records` 相同的公開 filters，並排除 hidden records/sources。匯出的欄位只包含教育 UI 已顯示的資料。CSV cells 會經過 sanitization，避免在 spreadsheet tools 開啟時觸發 formula execution。

## Geocoding 維運

Geocoding 是 maintenance action，不是 page-load behavior。

規則：

- Query 格式是 `臺北市 {locationText}`。
- 只送地點文字，不送姓名或違規事實。
- 每個結果都 cache 到 `geocoded_locations`。
- Nominatim 回傳 `429 Too many requests` 後，停止當前 batch。
- Shared cloud hosts 使用小 batch 與長 delay。

Render free 常使用 shared outbound IP，因此 map data 建議流程是：

1. 在本機匯入相同 PDFs。
2. 執行 `python3 scripts/geocode_locations.py --limit 5 --delay 10`，直到需要的地點都有 cache。
3. 執行 `npm run export:geocode`。
4. Commit `data/seed/geocoded_locations.json`。
5. Deploy。Startup 會匯入 cache，不從 Render 呼叫 Nominatim。

## Source Politeness

Crawler 使用描述性 User-Agent、sequential requests 與 page delay。不要 bypass access controls，也不要 aggressively parallelize government site access。

## 部署總覽

完整系統應部署成 Docker/Node service，不是 static site。App 需要 Next.js API routes、SQLite、Python PDF parsing、uploads、logs、migrations 與 admin endpoints。

建議 durable targets：

- Render paid web service + persistent disk。
- Fly.io volume。
- Railway 或 VPS persistent filesystem。
- 學校管理的 server 與 mounted storage。

Render free 可作 demo，但 filesystem 是 ephemeral。SQLite data、uploaded PDFs 與 logs 可能在 restart 或 redeploy 後消失。

## 必要環境變數

```bash
ADMIN_TOKEN="<strong-random-secret>"
DATABASE_URL="file:./drizzle/dev.db"
SQLITE_PATH="./drizzle/dev.db"
NODE_ENV="production"
```

## GitHub Actions

Workflows：

- `.github/workflows/ci.yml`：lint、typecheck、unit/integration tests、coverage、Playwright e2e 與 Lighthouse CI。
- `.github/workflows/deploy.yml`：`main` 通過 CI 後或手動 `workflow_dispatch` 時，build 並發布 Docker image 到 GitHub Container Registry。

Published images：

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

Dockerfile 安裝 build tools，因為 `better-sqlite3` 是 native addon。如果 `npm ci` fallback 到 `node-gyp`，需要 `make`、`gcc` 與 `g++`。

## Render 部署

建議 settings：

```text
Runtime: Docker
Branch: main
Instance type: Free for demo, paid for durable storage
ADMIN_TOKEN: <strong random secret>
SQLITE_PATH: ./drizzle/dev.db
DATABASE_URL: file:./drizzle/dev.db
NODE_ENV: production
Start Command: leave blank; use the Dockerfile CMD
```

Docker image 以 `sh scripts/start-render.sh` 啟動。該 script 會建立 local data directories、跑 migrations、在 database 為空時 seed starter data、匯入 committed geocode cache，然後用 Render `$PORT` 啟動 Next.js。

Durable Render deployment 請 attach persistent storage：

```text
/app/drizzle
/app/data
/app/logs
```

如果 Render deploy 以 status `127` 失敗，移除 custom Start Command overrides，讓 Render 使用 Dockerfile `CMD`。

## 本機 Docker Run

```bash
docker build -t public-safety-dashboard .
docker run --rm -p 3000:3000 \
  -e ADMIN_TOKEN="<strong-secret>" \
  -e SQLITE_PATH="./drizzle/dev.db" \
  -v "$PWD/drizzle:/app/drizzle" \
  -v "$PWD/data:/app/data" \
  -v "$PWD/logs:/app/logs" \
  public-safety-dashboard
```

## 測試策略

Layers：

- Python unit tests：parser、crawler extraction、violation parsing、geocoder privacy、geocode cache、starter seeding。
- Node integration tests：SQLite/API query behavior 與 admin token enforcement。
- Playwright e2e：dashboard、filters、pagination、map、language persistence、admin auth 與 responsive checks。
- Lighthouse CI：`/` 與 `/admin` 的 performance、accessibility、best practices、SEO gates。

核心指令：

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

`npm run test:coverage` 對 tracked Python ingestion modules 與 Node server integration code 執行 80% coverage gate。E2E 與 Lighthouse 使用 deterministic fixture database，因此 CI 不依賴 live Taipei DOT pages 或 Nominatim。

## Incident Response

優先順序：

1. 保護 privacy 與 public trust。
2. 停止可能讓 incident 惡化的操作，例如 repeated imports 或 geocoding。
3. 保留 evidence，但不要暴露 secrets。
4. Source corrections 診斷期間，優先使用 reversible hiding，而不是 deletion。

Severity guide：

| Severity | Examples | Response |
| --- | --- | --- |
| SEV1 | Admin token leaked、unauthorized write、private data accidentally added、corrupted public data | Disable admin actions、rotate token、hide affected data、inspect logs/DB before re-enabling。 |
| SEV2 | App down、database missing、migrations fail、map cache broken | Restore seed/cache、rerun migrations、redeploy known-good image、document data-loss scope。 |
| SEV3 | Nominatim 429、parser quality regression、e2e/Lighthouse regression | Pause risky operation、use local cache/manual review、fix parser/UI、rerun tests。 |
| SEV4 | Documentation typo 或 non-critical copy issue | Normal workflow 修正。 |

First 10 minutes：

1. 判斷 issue 影響 privacy、data integrity、availability 或只是 presentation。
2. 若 crawler/geocoder/import loops 相關，先停止。
3. 檢查 Render deploy logs、app logs 與 import logs。
4. 確認 `ADMIN_TOKEN`、`SQLITE_PATH`、`DATABASE_URL`、`NODE_ENV`。
5. 若 admin access 可疑，立即 rotate `ADMIN_TOKEN`。
6. 診斷未完成前，hide affected records/sources，不要刪除。

常見 incidents：

- Render free data reset：重新 seed starter data 與 geocode cache，或移到 persistent storage。
- Map empty after import：執行 admin geocode generation 或匯入 local geocode cache。
- Nominatim 429：停止、等待、用更小 batch/delay 重試，或使用 local cache workflow。
- PDF parser regression：保留 partial rows、為新 table shape 加 parser test、修 fallback logic、重新 import。
- Admin token issue：設定或 rotate strong token、restart deployment、檢查 import logs。
- Docker native addon failure：保留 Dockerfile 的 `build-essential`，並測試 Node base image changes。

Evidence to capture：

- Commit SHA 或 Docker image tag。
- Render deploy/log timestamp。
- 不含 secrets 的 import log excerpts。
- Source PDF URL/title。
- Exact command 或 admin action。
- 受影響 `sources`、`offender_records`、`geocoded_locations` counts。

## Known Risks

- PDF table formats 可能改變，需要 parser updates/manual review。
- Live import 與 geocoding 需要 network access，可能獨立於 dashboard 失敗。
- Render free 只適合 demo，因為沒有 persistent storage。
- Multi-admin production version 應將 single admin token 升級成 real authentication 與 audit logs。
