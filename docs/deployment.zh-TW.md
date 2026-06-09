# 部署指南

## 建議部署目標

請使用有 persistent disk 的 container host，例如 Fly.io、Render、Railway、VPS 或學校管理的 server。本 app 使用 SQLite 加上本機 PDF/import artifacts，因此沒有 persistent filesystem storage 的 serverless-only 平台不適合作為第一版部署目標。

## 必要環境變數

```bash
ADMIN_TOKEN="<strong-secret>"
DATABASE_URL="file:./dev.db"
SQLITE_PATH="./drizzle/dev.db"
```

`ADMIN_TOKEN` 不能是 `change-me`；server 會拒絕這個 placeholder。

## GitHub Actions

目前包含兩個 workflows：

- `.github/workflows/ci.yml`：lint、typecheck、unit/integration tests、Playwright e2e、Lighthouse CI。
- `.github/workflows/deploy.yml`：`main` 上 CI 通過後 build/publish Docker image 到 GitHub Container Registry，也可透過 `workflow_dispatch` 手動執行。

完整 app 需要 Next.js API routes、SQLite、Python PDF import scripts、uploads、logs 與 server-side admin endpoints，因此請部署為 Docker/Node service。

## Docker / Full App Deployment

Published image tags：

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

Workflow 會將 `<owner>/<repo>` 轉成 lowercase，因為 GHCR image names 必須是 lowercase。

Docker image 安裝 `build-essential`，因為 `better-sqlite3` 是 native Node addon。若 base image 的 Node version 沒有 prebuilt binary，`npm ci` 會 fallback 到 `node-gyp` compilation，需要 `make`、`gcc`、`g++`。如果 GitHub Actions 失敗並顯示 `gyp ERR! stack Error: not found: make`，請保留 Dockerfile 中的 build toolchain。

### GitHub Deployment Flow

1. Push 或 merge 到 `main`。
2. 等待 `CI` workflow 通過。
3. `Build and Publish Image` workflow 發布 Docker image 到 GHCR。
4. 開啟 deploy workflow summary，複製 image tag。
5. 設定 runtime host 拉取該 image。
6. 設定 `ADMIN_TOKEN`，並為 `/app/drizzle`、`/app/data`、`/app/logs` mount persistent storage。
7. 第一次服務前執行 `npm run db:migrate`，或使用 host 的 release-command mechanism。

如果 package 是 private，且 deployment host 直接從 GHCR pull image，請建立具有 package read access 的 GitHub token，並在 host 設定 registry credentials。

## Render Deployment

線上 app 可用 Render Docker web service 執行：

```text
https://publicsafetydashboard.onrender.com
```

Render free instances 可同時執行 frontend/backend，但不支援 persistent disks。Imported SQLite data、uploaded PDFs、logs 可能在 redeploy、restart、idle spin-down 後消失。若需要 durable data，請使用 paid Render service 搭配 persistent disk。

建議 Render settings：

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

Docker image 啟動指令：

```bash
sh scripts/start-render.sh
```

該 script 會建立 local data directories、執行 `npm run db:migrate`、在 records table 為空時 seed bundled starter dataset，然後以 Render 的 `$PORT` 啟動 Next.js。

Render 上匯入 PDFs 後，請開啟 `/admin`，輸入 `ADMIN_TOKEN`，執行 **Generate Map Coordinates**。Imported records 不會自動有 latitude/longitude；map 只使用 `geocoded_locations` 中已快取的 rows。

Render free 可能因 shared outbound IP 收到 Nominatim `429 Too many requests`。建議免費流程是在本機 geocode，執行 `npm run export:geocode`，commit `data/seed/geocoded_locations.json`，再 redeploy。Startup 會用 `scripts/seed_geocode_cache.py` 匯入該 cache。

如果 Render deploy 以 status `127` 失敗，請檢查 Render service settings，移除任何 custom Start Command。Command override 會繞過 Dockerfile `CMD`，也可能因 Render shell parsing 而失敗。

若使用 paid durable deployment，請 attach persistent storage：

```text
/app/drizzle
/app/data
/app/logs
```

## Local Docker Run

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

第一次使用前執行 migrations：

```bash
docker run --rm \
  -e SQLITE_PATH="./drizzle/dev.db" \
  -v "$PWD/drizzle:/app/drizzle" \
  public-safety-dashboard npm run db:migrate
```

## Render / Railway / Fly.io Pattern

1. 連接 GitHub repository。
2. 使用 Dockerfile build。
3. Mount persistent storage：
   - `/app/drizzle`
   - `/app/data`
   - `/app/logs`
4. 設定 `ADMIN_TOKEN`。
5. 初次 setup 時執行 `npm run db:migrate`，或使用平台支援的 release command。
6. 使用 default Docker command 啟動。

## Vercel Note

Vercel 很適合許多 Next.js apps，但本專案是 local-first，包含 SQLite、Python PDF parsing、uploads 與 import logs。除非先把 persistence 與 ingestion 移到外部服務，否則不建議使用 Vercel。
