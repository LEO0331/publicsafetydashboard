# Production Incident Playbook

## Incident Goals

1. 保護 public trust 與 privacy。
2. 在安全前提下維持教育 dashboard 可用。
3. 避免重複 scraping/geocoding，避免違反來源網站或 Nominatim limits。
4. 保存足夠診斷證據，但不暴露 secrets 或不必要 personal data。

## Severity Levels

| Severity | Examples | Response |
| --- | --- | --- |
| SEV1 | Admin token 外洩、unauthorized import/write、意外加入 private data、app 顯示 misleading corrupted data | 停用 admin actions、rotate token、必要時 hide affected records、調查 logs 與 DB state 後再恢復 |
| SEV2 | App down、deploy 後 database 遺失、migrations fail、map/geocode cache broken | 從 seed/cache 恢復、重跑 migrations、redeploy last known good image、記錄 data-loss scope |
| SEV3 | Nominatim 429、PDF parse quality degraded、部分 rows `needsReview=true`、Lighthouse/e2e regression | 暫停 risky operation、使用 local cache/manual review、修 parser/UI、重跑 tests |
| SEV4 | 文件 typo、非 critical UI copy、已知限制被注意到 | 正常 workflow 修復 |

## 前 10 分鐘 Checklist

1. 判斷問題影響 privacy、data integrity、availability，還是只有 presentation。
2. 停止可能讓情況惡化的動作，例如 crawler、geocoder 或 repeated imports。
3. 檢查 Render deploy logs、app logs、import logs。
4. 確認環境變數：`ADMIN_TOKEN`、`SQLITE_PATH`、`DATABASE_URL`、`NODE_ENV`。
5. 如果 admin access 可疑，立即 rotate `ADMIN_TOKEN`。
6. 如果 source data 可能有錯，先 mark affected records hidden，不要在診斷完成前直接刪除。

## 常見 Incidents

### Render Free Data Reset

Symptoms：

- Dashboard 在 redeploy/restart 後回到 starter data 或 empty data。
- Uploaded PDFs/logs 消失。

Cause：

- Render free filesystem 是 ephemeral。

Response：

1. 用 `npm run seed:initial` 或 startup script 重新 seed。
2. 重新 import 需要的 PDFs。
3. 用 committed `data/seed/geocoded_locations.json` 重新 seed geocode cache。
4. 若需要 durable data，移到 persistent disk 或 VPS/volume host。

### Map Empty After Import

Symptoms：

- Records/table 有資料，但 map 沒 circles。

Cause：

- `offender_records` 存在，但 `geocoded_locations` 沒有效 `lat`/`lng` rows。

Response：

1. 在 `/admin` 小批次執行 Generate Map Coordinates。
2. 如果 Nominatim 回 429，停止並改用 local geocode export workflow。
3. 確認 `/api/locations` 回傳 rows 且 `lat`、`lng` 非 null。

### Nominatim HTTP 429

Symptoms：

- Import log 包含 `HTTP Error 429: Too many requests`。

Response：

1. 停止 geocoding；script 會在第一個 429 後停止。
2. 等待後再重試。
3. 使用 limit `1-5`、delay `10-30` 秒。
4. Render free 優先使用 local geocoding 與 `npm run export:geocode`。
5. 不要繞過 Nominatim limits。

### PDF Parser Regression

Symptoms：

- `needsReview=true` 異常增加。
- 匯入新公告後 missing names/dates/locations。

Response：

1. 保留 partial rows 供 audit；不要 silent discard。
2. 在 logs 保存 PDF/source URL。
3. 用 problematic row/table shape 加 parser unit test。
4. 改善 `pdf_parser.py` table/text fallback。
5. 重新 import affected source。

### Admin Token Issue

Symptoms：

- Admin routes 回 503 或 401。
- Token 可能被 unauthorized user 取得。

Response：

1. 若 missing/placeholder，設定 strong `ADMIN_TOKEN`。
2. 若 leaked，在 host environment rotate token。
3. Restart deployment。
4. Review import logs 是否有 suspicious writes。

### Docker Build Failure For `better-sqlite3`

Symptoms：

- `node-gyp` error，常見為 `not found: make`。

Response：

1. Dockerfile 保留 `build-essential`。
2. 確認 base image 與 Debian/Bookworm compatible。
3. 不要在未測試 native addon build 前切換 Node base image。

## Recovery Commands

```bash
npm run db:migrate
npm run seed:initial
npm run seed:geocode
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

## Evidence To Capture

- Commit SHA 或 Docker image tag。
- Render deploy/log timestamp。
- 不含 secrets 的 import log excerpts。
- Source PDF URL/title。
- 實際執行的 command 或 admin action。
- Affected `sources`、`offender_records`、`geocoded_locations` row counts。

## Prevention

- Admin actions 保持 token-protected。
- Geocoding 保持 cached 與 rate-limited。
- 更改 ingestion code 後執行 parser/import tests。
- 為 demo recovery 保持 seed JSON files committed。
- Serious deployments 使用 persistent storage。
