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

`npm run seed:initial` 會匯入官方 `PageSize=105` 列表中 94 份符合格式的臺北市交通局公開 PDF 公告，範圍從 115.08.26 到 111.05.09。它包含一般 `臺北市酒(毒)駕及拒測累犯公布名單`、`臺北市酒(毒)及拒測駕累犯公布名單` 與 `臺北市酒駕累犯公布名單` 檔案，排除另外一種 `三次以上且設籍本市者` subtype，只保存 parsed rows，不 bundled 原始 PDF binaries 或照片。

`npm run seed:geocode` 會匯入 `data/seed/geocoded_locations.json`。Committed seed 內含 490 個 unique bundled starter locations 中 412 個由 Nominatim 解析出的座標，讓 public demo map 部署後即可使用。其餘 78 個未解析地點不放入 JSON cache，可之後透過 admin maintenance 重新嘗試或人工檢視。

## Admin Operations

### 管理驗證強化

原先瀏覽器保留 `ADMIN_TOKEN`，每次管理請求都透過 `x-admin-token` 傳送。現在請開啟 `/admin`，輸入「管理權杖」並按「登入」。只有 `POST /api/admin/auth/login` 會收到原始憑證，正式環境透過 HTTPS 傳送。登入成功後立即清空輸入框與 React 權杖狀態，才開始載入受保護資料。後續請求使用不透明的 HttpOnly cookie；憑證及工作階段識別碼不存入 localStorage、sessionStorage 或 IndexedDB。舊有標頭已停用，沒有相容開關。直接執行 CLI 匯入不使用 HTTP 管理驗證。

`GET /api/admin/auth/session` 僅回傳驗證狀態與到期資訊，不回傳識別碼；重新整理頁面會檢查現有工作階段，正常狀態查詢不延長閒置期限。按「登出」會呼叫 `POST /api/admin/auth/logout`，撤銷伺服器端工作階段並清除 cookie。登出或到期會清空包含資安報告的受保護畫面資料；較早驗證狀態的延遲回應不能重新填入畫面。驗證失敗訊息採通用文字，驗證回應使用 `Cache-Control: no-store`。

- 伺服器產生具 **256 位元隨機性**的工作階段識別碼，只在 Route Handlers 共用的程序內有界儲存區保留其雜湊及生命週期資訊。**閒置 30 分鐘**或**建立滿 8 小時**即失效，以先到者為準；伺服器自行驗證，不只依賴 cookie 到期。最多 **32 個有效工作階段**，清除過期項目後仍滿載就拒絕新建。登出只撤銷目前工作階段。
- 登入為**整個程序每滾動 60 秒最多 10 次嘗試**，超過回傳 429 與 `Retry-After`，時間到自動恢復。僅使用有界記憶體，不保存 IP 或信任轉送標頭。惡意流量可能暫時影響合法管理者；程序重啟會重設限流並使全部工作階段失效。
- 正式環境使用 `__Host-admin-session`，設定 `HttpOnly`、`Secure`、`SameSite=Strict`、`Path=/`、到期時間，且不設定 Domain；刪除時採相符屬性。HttpOnly 防止 JavaScript 讀出識別碼，但同源惡意腳本仍可能代管理者操作，因此不能取代 XSS 防護。
- 所有管理異動（登入、登出、匯入、爬取、地理編碼、可見性及彙總還原）皆要求 **`x-admin-csrf: 1`** 及精確符合信任來源的 **`Origin`**。拒絕跨來源瀏覽器異動，不開放寬鬆 CORS。還原仍額外要求既有的 `x-security-restore: 1`。維護與匯出請求不再傳原始權杖。

Render 保留現有 `ADMIN_TOKEN` 與 `ENABLE_API_OBSERVABILITY` 值，使用平台自動提供的 `RENDER_EXTERNAL_URL` 作為公開來源。若使用自訂網域或其他反向代理，設定唯一可選的伺服器端 **`ADMIN_APP_ORIGIN=https://實際公開主機`**，精確對應管理者瀏覽器中的來源（協定、主機及非預設連接埠，不含路徑）。兩者皆未設定時使用請求 URL 的來源，不以用戶端 `Forwarded`、`X-Forwarded-Host` 或 `X-Forwarded-Proto` 決定信任來源。管理驗證不需新增 Blueprint、執行個體、工作階段資料庫、Redis 或磁碟。部署、重啟或改由另一程序處理請求會使工作階段失效；此設計以單一應用程序為前提。

一般非正式開發只允許在 loopback（`localhost`、`127.0.0.1` 或 `::1`）使用 HTTP 與無前綴 cookie。正式建置的自動化測試需明確設定 **`ADMIN_ALLOW_LOOPBACK_HTTP=1`** 才可在 loopback HTTP 使用；此例外不會開放遠端正式主機的不安全 cookie。Render 請勿設定此選項。Docker 的 HTTP 本機預覽若使用正式建置，必須透過 loopback 存取並明確啟用此測試例外，或改用 HTTPS。

輪替憑證時，在既有服務設定以強隨機值取代伺服器端 `ADMIN_TOKEN`，套用環境變更後重新登入。設定權杖變更或移除即使既有工作階段失效；缺少權杖或使用 `change-me` 會拒絕驗證。不得將權杖放入 `NEXT_PUBLIC_*`、截圖、問題回報、回應內容或日誌。關閉 `ENABLE_API_OBSERVABILITY` 仍保留驗證、CSRF、登入限流與維護資源保護。

排錯方式：

- **401／回到登入畫面：**工作階段已到期、遭撤銷，或因重啟／輪替遺失，請重新登入。舊有 `x-admin-token` 用戶端需改為登入及 cookie 流程。
- **登入 503：**確認伺服器有非預設 `ADMIN_TOKEN`，並檢查是否已有 32 個有效工作階段。等候未使用項目到期，或將其登出；排錯不得印出 cookie。
- **403：**檢查瀏覽器來源是否符合 `ADMIN_APP_ORIGIN` 或 `RENDER_EXTERNAL_URL`；自訂網域可能需要前者。API 用戶端需提供正確 Origin 與 `x-admin-csrf: 1`，還原另保留專用標頭。
- **429：**依 `Retry-After` 等候，區分登入限流與既有維護併行限制，不會永久鎖定帳戶。
- **登入成功但重新整理失效：**確認瀏覽器接受 cookie、正式環境為 HTTPS，且請求皆由同一程序處理。本機測試才檢查 loopback 例外，不可降低正式 cookie 安全設定。

啟用觀測時，登入成功／失敗／受限、登出及無效或過期工作階段存取，使用既有有界操作稽核機制，只記錄固定動作、UTC 時間與狀態；不含憑證、工作階段識別碼或雜湊、cookie／標頭值、請求內容或原始 IP。正常成功的工作階段查詢不膨脹活動統計。彙總備份維持 Phase 1／2 格式及還原規則，不包含驗證操作事件。

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
- Node integration tests：SQLite/API query behavior、工作階段生命週期、登入限流與管理授權。
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
- 管理驗證問題：依上述驗證排錯步驟處理，不在診斷日誌中放入憑證或 cookie。
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
- 多管理者版本需個別帳戶及可歸責的操作事件；目前共用憑證不能辨識個別操作人員。

## 兼顧隱私的 API 可觀測性（F16）

於既有 Render 服務設定 `ENABLE_API_OBSERVABILITY=true` 並重新部署（預設關閉）。在 `/admin` 使用原有強度足夠的 `ADMIN_TOKEN` 明確登入後，再按「載入資安報告」，或由具有效工作階段的 `GET /api/admin/security` 取得 JSON。僅手動更新；登出或工作階段到期會清除畫面上的報告。正式環境應使用 HTTPS；不另建服務、資料庫或付費資源。

- 彙總固定路由、HTTP 方法、處理器回應狀態、延遲區間、未驗證用戶端分類、管理驗證結果與公開列表／CSV 回傳列數。成功讀取資安報告不計入統計；驗證失敗仍計入。回應識別碼僅置於回應標頭，不保存。不保存原始 IP、轉送標頭、UA、URL、搜尋條件、請求內容、權杖、姓名或個案瀏覽紀錄；既有應用及主機日誌不在此保證範圍。
- 未知 API 路徑僅依固定分類被動觀測並回傳 404，不執行掃描、來源識別、指紋、地理情資或依分類自動封鎖。僅涵蓋已包裝的處理器回應，不代表網路送達、靜態頁面或框架所有錯誤。
- UTC 每五分鐘視窗，最多 288 個近期視窗（約 24 小時），每視窗最多 100,000 筆觀測，超額計為丟棄。p95 為延遲區間上界，不是精確百分位。僅保留有觀測的視窗；缺失不等於零流量。CSV 回應及列數不代表下載完成或惡意行為。
- 完成的非空視窗以 `public_safety.api_aggregate.v1` 輸出至結構化主機日誌，阻塞時跳過日誌視窗而非 HTTP 回應。程序重啟後記憶體歷史消失，未完成視窗可能遺失。不得與個案紀錄關聯。
- 即使關閉觀測仍套用資源保護：固定長度雜湊的定時安全權杖比較、管理 JSON 16 KiB、讀取請求內容 30 秒、單一程序同時僅允許一個維護操作（忙碌回傳 429）、頁碼上限 1,000,000、CSV 最多 10,000 列及 8 MiB（超過回傳 413，請縮小篩選範圍，不靜默截斷）。保留既有 CSV 公式防護及隱藏紀錄規則。非分散式鎖或逐 IP 限流；CLI 與排程不在 HTTP 鎖範圍。

依原有驗證後映像流程部署；尚未確認正式主機、代理拓樸或真實流量。停用旗標並重新部署即可停止觀測。詳細邊界見英文操作文件。

## Phase 2：輕量資料存取治理（F17）

不需新增 Render 環境變數。使用原有 ADMIN_TOKEN 與 ENABLE_API_OBSERVABILITY=true，在管理頁載入資安報告。主畫面維持六項指標及簡短調查訊號，匯出、還原、操作紀錄與詳細表格收在預設折疊的「詳細資訊、操作紀錄與資料還原」。

待檢查資料列的條件為信心值低於 1 或缺少違規類型；信心值 1 不保證解讀完整。先核對官方 PDF，不必為清空清單而隱藏正確資料。正常 parsed 且 0 review 的公告通常不需處理。確認錯誤、撤回或隱私問題時才暫時隱藏；永久修正依既有公告複核 manifest 流程。免費主機重啟可能遺失本機可見性異動，本次不自動修改任何資料。

資安 CSV 為獨立彙總匯出，含 UTC 視窗、live/restored、固定指標與數量，省略零值（不含姓名或識別資料），供離線分析，不用於還原。JSONL 備份僅包含已結束的五分鐘視窗，不含目前視窗及個別操作紀錄；已結束不代表完整觀測。僅使用自己單一程序的合法匯出或去除主機前綴的 Phase 1 彙總日誌。還原需有效工作階段 cookie、精確同源 Origin、`x-admin-csrf: 1` 及 `x-security-restore: 1`，限制 4 MiB／288 視窗／每列 16 KiB／10 秒收取；驗證固定欄位與計數、拒絕無效內容並略過重複、過期、未完成或目前程序啟動後的視窗。只還原約 24 小時範圍內的歷史，仍為記憶體資料，非持久化或簽章備份。

管理操作紀錄只保留 UTC、固定動作及 HTTP 狀態（含單筆／整份公告的隱藏或取消隱藏類別），不保存目標 ID、姓名、權杖或管理者個人身分。記憶體最多 100 筆，畫面顯示最新 20 筆，每五分鐘最多輸出 100 筆；可能因容量與日誌阻塞遺失，非永久或防竄改稽核帳本，不能個別歸責。個別事件不還原。調查訊號使用固定門檻：每五分鐘 CSV 成功回應至少 10 次、管理驗證拒絕至少 5 次、5xx 及觀測限制。非已確認的攻擊，不自動封鎖。無額外服務、資料庫或付費資源。
