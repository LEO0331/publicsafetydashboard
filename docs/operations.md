# Operations, Deployment, Testing, And Incidents

## Local Setup

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run seed:initial
npm run dev
```

Open the dashboard at `http://localhost:3000` and the admin page at `http://localhost:3000/admin`.

Set a non-default admin token before using import actions:

```bash
ADMIN_TOKEN="<strong-secret>"
```

`ADMIN_TOKEN=change-me` is rejected by design.

## Import And Maintenance Commands

```bash
python3 scripts/crawl_sources.py
python3 scripts/import_pdf.py --url "<PDF_URL>"
python3 scripts/import_pdf.py --file ./path/to/file.pdf
python3 scripts/geocode_locations.py --limit 5 --delay 16
python3 scripts/export_geocode_cache.py
python3 scripts/seed_geocode_cache.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
npm run seed:initial
npm run export:geocode
npm run seed:geocode
```

`npm run seed:initial` imports the bundled starter dataset parsed from 94 matching Taipei DOT public PDF announcements on the official `PageSize=105` listing, from 115.08.26 through 111.05.09. It includes regular `臺北市酒(毒)駕及拒測累犯公布名單`, `臺北市酒(毒)及拒測駕累犯公布名單`, and `臺北市酒駕累犯公布名單` files, excludes the separate `三次以上且設籍本市者` subtype, and stores parsed rows only; original PDF binaries/photos are not bundled.

`npm run seed:geocode` imports `data/seed/geocoded_locations.json`. The committed seed contains Nominatim-resolved coordinates for 412 of 490 unique original starter locations so the public demo map works immediately after deployment. Documented `not_found` results are also retained in the cache without coordinates, preventing routine monthly retries. They can be retried manually after reviewing the published location text.

### Monthly refresh

`.github/workflows/monthly-refresh.yml` runs on the fifth day of each month and can be dispatched manually. It migrates a temporary SQLite database, restores both committed seeds, applies reviewed announcement changes, discovers eligible Taipei DOT PDFs, and imports new URLs. It validates parsed rows and source hashes, then exports `initial_announcements.json` before geocoding. It then processes at most `MONTHLY_GEOCODE_LIMIT` pending normalized location queries (default 25), sequentially with a 16-second delay. `GEOCODE_DELAY_SECONDS` and the geocoder provider URL can be configured. A provider failure leaves the announcement export intact; the workflow summary reports data freshness and map coverage separately.

The workflow commits only changed seed JSON files. It dispatches CI after a commit; successful CI follows the normal image deployment workflow. Public Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/) limits regularly scheduled geocoding to four requests per minute and requires a single thread, cached results, and an identifying User-Agent. Never send names or violation facts to the provider. The map omits unresolved coordinates while records remain in the table, filters, and statistics.

### Reviewed announcement corrections and withdrawals

Verify the change against the official source. A source missing from the monthly crawl can still be available on an older listing page.

For a withdrawal, add the exact `pdfUrl` and old `contentHash` from the bundled seed to `data/seed/announcement_reviews.json` as `{"action":"withdraw","pdfUrl":"…","sha256":"…"}`. For a corrected PDF at the same URL, use `{"action":"replace","pdfUrl":"…","previousSha256":"…","sha256":"…"}`. Use the old seed hash and the SHA-256 of the reviewed replacement, respectively.

For another correction, move the earlier `previousSha256` into `retiredSha256`, an array of older blocked digests. Keep that array when withdrawing a previously corrected PDF and add its last `previousSha256` to it. This keeps older copies blocked.

Regenerate the bundled seed against a temporary database before committing the manifest and `data/seed/initial_announcements.json` together.

```bash
REVIEW_DIR="$(mktemp -d)"
export SQLITE_PATH="$REVIEW_DIR/review.db"
npm run db:migrate
python3 scripts/seed_initial_data.py --for-refresh
python3 scripts/refresh_monthly.py --review-only
unset SQLITE_PATH
```

Check the resulting seed diff. Startup applies reviewed changes to persistent databases. A withdrawal removes the source and its rows and blocks future imports of the listed URL or digests. A replacement must match the new digest and preserves record hides. If a replacement cannot safely match a hidden row, it stops before changing data. Before deploying, review and resolve that case with the source hidden. Previously published Git history and deployed backups require separate handling.

## Admin Operations

The `/admin` page supports:

- Crawling Taipei DOT announcements.
- Importing a PDF URL.
- Uploading a local PDF.
- Generating cached map coordinates.
- Viewing parser/import logs.
- Reviewing rows marked `needsReview`.
- Hiding/unhiding sources or records when a source is corrected or removed.

Hide actions update flags and do not delete rows, preserving auditability.

URL import accepts HTTPS links on `dot.gov.taipei` and `www-ws.gov.taipei`, including redirects within those hosts. For other authorized files, download and review them first, then use the local upload. Both paths limit PDF size to 20 MiB. Local uploads show the supplied source title without publishing the file path.

## CSV Export

The dashboard CSV export uses the same public filters as `/api/records` and excludes hidden records/sources. It exports only fields already shown in the educational UI. CSV cells are sanitized to prevent spreadsheet formula execution when opened in desktop spreadsheet tools.

## Geocoding Operations

Geocoding is a maintenance action, not a page-load behavior.

Rules:

- Query format is `臺北市 {locationText}`.
- Send only location text, never names or violation facts.
- Skip locations that only occur in hidden records or hidden sources.
- Cache every result in `geocoded_locations`.
- Stop a batch after the first Nominatim `429 Too many requests`.
- Use small batches and long delays on shared cloud hosts.

Render free often shares outbound IPs with other users, so prefer this workflow for map data:

1. Import the same PDFs locally.
2. Run `python3 scripts/geocode_locations.py --limit 5 --delay 16` until needed locations are cached.
3. Run `npm run export:geocode`.
4. Commit `data/seed/geocoded_locations.json`.
5. Deploy. Startup imports that cache without calling Nominatim.

## Source Politeness

Crawler requests use a descriptive User-Agent, sequential requests, and delay between pages. Do not bypass access controls or aggressively parallelize government site access.

## Deployment Overview

Deploy the complete app as a Docker/Node service, not as a static site. The app needs Next.js API routes, SQLite, Python PDF parsing, uploads, logs, migrations, and admin endpoints.

Recommended durable targets:

- Render paid web service with persistent disk.
- Fly.io with volume.
- Railway or a VPS with persistent filesystem.
- A school-managed server with mounted storage.

Render free is acceptable for demos, but its filesystem is ephemeral. SQLite data, uploaded PDFs, and logs can disappear after restarts or redeploys.

## Required Environment Variables

```bash
ADMIN_TOKEN="<strong-random-secret>"
DATABASE_URL="file:./drizzle/dev.db"
SQLITE_PATH="./drizzle/dev.db"
NODE_ENV="production"
```

## GitHub Actions

Workflows:

- `.github/workflows/ci.yml`: lint, typecheck, unit/integration tests, coverage, Playwright e2e, and Lighthouse CI.
- `.github/workflows/monthly-refresh.yml`: prepares and verifies the seeds with read-only repository access; a separate job publishes changed seeds and dispatches CI.
- `.github/workflows/deploy.yml`: builds the commit that passed CI on `main` and publishes its image to GitHub Container Registry. Maintainers can also dispatch builds manually.

Published images:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

The Dockerfile installs build tools because `better-sqlite3` is a native addon. If `npm ci` falls back to `node-gyp`, `make`, `gcc`, and `g++` are required.

## Render Deployment

Recommended settings:

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

The Docker image starts with `sh scripts/start-render.sh`. That script creates local data directories, runs migrations, seeds starter data if the database is empty, imports the committed geocode cache, and starts Next.js on Render's `$PORT`.

For durable Render deployment, attach persistent storage for:

```text
/app/drizzle
/app/data
/app/logs
```

If a Render deploy fails with status `127`, remove custom Start Command overrides so Render uses the Dockerfile `CMD`.

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

## Testing Strategy

Layers:

- Python unit tests: parser, crawler extraction, violation parsing, geocoder privacy, geocode cache, starter seeding.
- Node integration tests: SQLite/API query behavior and admin token enforcement through server helpers.
- Playwright e2e: dashboard, filters, pagination, map, language persistence, admin auth, and responsive checks.
- Lighthouse CI: performance, accessibility, best practices, and SEO gates for `/` and `/admin`.

Core commands:

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

`npm run test:coverage` enforces 80% project-focused coverage for tracked Python ingestion modules and Node server integration code. E2E and Lighthouse use a deterministic fixture database so CI does not depend on live Taipei DOT pages or Nominatim.

Lighthouse CI 0.16 requires Node.js 22.19 or newer.

## Incident Response

Priorities:

1. Protect privacy and public trust.
2. Stop operations that can make the incident worse, such as repeated imports or geocoding.
3. Preserve evidence without exposing secrets.
4. Prefer reversible hiding over deletion while diagnosing source corrections.

Severity guide:

| Severity | Examples | Response |
| --- | --- | --- |
| SEV1 | Admin token leaked, unauthorized write, private data accidentally added, corrupted public data | Disable admin actions, rotate token, hide affected data, inspect logs/DB before re-enabling. |
| SEV2 | App down, database missing, migrations fail, map cache broken | Restore seed/cache, rerun migrations, redeploy known-good image, document data-loss scope. |
| SEV3 | Nominatim 429, parser quality regression, e2e/Lighthouse regression | Pause risky operation, use local cache/manual review, fix parser/UI, rerun tests. |
| SEV4 | Documentation typo or non-critical copy issue | Fix through normal workflow. |

First 10 minutes:

1. Identify whether the issue affects privacy, data integrity, availability, or presentation.
2. Stop crawler/geocoder/import loops if they are involved.
3. Check Render deploy logs, app logs, and import logs.
4. Confirm `ADMIN_TOKEN`, `SQLITE_PATH`, `DATABASE_URL`, and `NODE_ENV`.
5. Rotate `ADMIN_TOKEN` immediately if admin access is suspect.
6. Hide affected records/sources instead of deleting while diagnosis is incomplete.

Common incidents:

- Render free data reset: re-seed starter data and geocode cache, or move to persistent storage.
- Map empty after import: run admin geocode generation or import a local geocode cache.
- Nominatim 429: stop, wait, retry with smaller batches/delays, or use local cache workflow.
- PDF parser regression: keep partial rows, add a parser test for the new shape, fix fallback logic, re-import.
- Admin token issue: set or rotate a strong token, restart deployment, review import logs.
- Docker native addon failure: keep `build-essential` in Dockerfile and test Node base image changes.

Evidence to capture:

- Commit SHA or Docker image tag.
- Render deploy/log timestamp.
- Import log excerpts without secrets.
- Source PDF URL/title.
- Exact command or admin action run.
- Counts of affected `sources`, `offender_records`, and `geocoded_locations` rows.

## Known Risks

- PDF table formats may change and require parser updates/manual review.
- Live import and geocoding require network access and can fail independently of the dashboard.
- Render free is demo-only because persistent storage is unavailable.
- A multi-admin production version should replace the single admin token with real authentication and audit logs.

## Privacy-preserving API observability (F16)

The existing application, not a standalone sensor, exposes an administrator-only Security & Operations panel at `/admin` and an aggregate JSON endpoint at `GET /api/admin/security`. Set `ENABLE_API_OBSERVABILITY=true` in the Render service environment and redeploy; the flag defaults to disabled. Keep the existing strong `ADMIN_TOKEN`; there is no separate password or database. The endpoint uses the existing token check and no-store responses. Use HTTPS in production. Reports are loaded on demand, never automatically polled or public. Changing or clearing the token clears the displayed report. No new dependencies, service, persistent volume or paid infrastructure is required.

- The shared Node route wrapper records fixed route names, method, handler-returned status, latency histogram, coarse unverified client classification, authorization outcome and public records/CSV row counts. Successful security-report reads are excluded; denied reads are observed. Generated request IDs are returned in response headers only, not retained or logged. No raw IP, forwarded headers, user agent, URL/query, request body, token, name, record ID or person-level access history is stored by this module. Existing application and hosting logs are separate and not subject to this guarantee.
- Unknown `/api/*` paths reaching the explicit catch-all receive a generic 404; only fixed passive path categories are aggregated. No scanning, decoys, network attribution, geolocation, client fingerprinting or classifier-triggered blocking. This is handler-response coverage, not network delivery, full-site analytics, framework 405s, static files or all external errors. Framework normalization may also prevent some paths reaching the catch-all.
- UTC five-minute buckets, up to 288 current/recent buckets (approximately 24 hours), 100,000 observed responses per bucket; excess observations are counted as dropped. Only windows with observations are stored. Approximate p95 is a histogram upper bound (overflow >120 seconds), not an exact percentile. Counts are per process; missing windows are not proof of no activity or continuous uptime. Successful GET CSV responses and returned row counts do not prove completed downloads; HEAD does not count exported rows. Export volume and unverified client signals do not prove malicious behavior. Do not join these metrics to person-level public records.
- Completed nonempty buckets are emitted as `public_safety.api_aggregate.v1` JSON lines on rollover, checked once per minute while the process runs; no external keepalive. Backpressure skips log windows, not HTTP responses. Reports include the current partial window. No persistent history or automatic recovery: Render restarts clear the in-memory window state and the final partial window may be lost. Operator can save sanitized aggregates through authorized host log access if needed; provider log retention is separate.
- Resource safeguards apply even while observation is disabled: timing-safe hashed token comparison (no change to existing valid configured tokens), 16 KiB admin JSON body limit, 30-second body receipt deadline, 1 process-local active maintenance request (crawl/import/geocode/hide; 429 with Retry-After when busy), maximum 1,000,000 page index, public CSV query fetches at most 10,001 rows and returns 413 rather than silently truncating if more than 10,000 rows or an 8 MiB serialized CSV. Narrow filters and retry. Existing CSV formula sanitization and hidden-record exclusion remain intact. This is not a distributed lock, per-IP rate limiter or restriction on permitted public research. CLI and scheduled maintenance are outside the HTTP guard. Admin routes also add basic security headers; no third-party telemetry or database writes for metrics.

Deploy through the existing verified image workflow. Before merging, review CI; after deploying confirm `/admin`, enable the flag, enter the existing token and load the report. Review aggregated counts over normal use; avoid testing against production with synthetic probes. To stop tracking, set the flag false and redeploy. Do not publish the authenticated report or raw provider logs. No live deployment or proxy topology verification is implied by the implementation.

## Phase 2 — lightweight data access governance (F17)

No new Render configuration. Use the existing ADMIN_TOKEN and ENABLE_API_OBSERVABILITY=true. In /admin, load Security & Operations and expand Details, audit & data recovery only when needed. The default view remains the six metrics and a short investigation summary. The existing parser-review and announcement controls are independent of security indicators.

### Source review and visibility

The parser sets needs_review when confidence is below 1 **or** the violation-type list is empty. A confidence of 1 is not proof of a correct or complete interpretation. Compare the row with the official announcement; do not hide valid rows merely to empty the queue. Parsed sources with zero review rows ordinarily need no intervention. Use reversible hiding for confirmed errors or a privacy concern while investigating, and the reviewed withdrawal/replacement manifest procedure above for durable corrections. Render free restarts can lose local visibility changes. Neither the review queue nor an investigation indicator automatically changes public visibility.

### Reports and recovery

- Export security CSV is separate from the public records CSV. It contains sparse, fixed numeric metrics with UTC bucket start and live/restored origin; absent zero-valued metrics are omitted. Includes the current partial bucket. No names, record IDs, source URLs or raw request data. The CSV is for analysis, not re-import.
- Download JSONL backup exports ended five-minute aggregate buckets only (not the current bucket or individual operation events). An ended bucket may still have partial coverage. The same event schema accepts Phase 1 aggregate-only JSONL logs after removing hosting prefixes. Do not upload raw logs, administrative operation events or public record CSVs.
- POST /api/admin/security accepts text/plain with x-security-restore: 1 and the existing admin token; browser requests must be same-origin, no CORS. Maximum 4 MiB, 288 lines/windows, 16 KiB per line, 10-second receive deadline, serialized with the process-local maintenance guard. Validate exact fixed metric schema, timestamp alignment, bounded counts and count consistency before merging. Reject malformed files without merging any rows. Skip expired, duplicate, overlapping/live or future buckets; only buckets ending at or before the observation-start bucket boundary are eligible. Imported buckets are marked restored and not re-emitted into host aggregate logs. Only trust your own single-process exports; imports are not signed, and no cross-instance aggregation or durable backup is implied. History remains volatile and ages out in the same approximately 24-hour retention horizon. Export before planned restarts; the latest partial bucket is not recoverable through the JSONL backup.

### Operational audit and investigation

With observation enabled, authenticated maintenance attempts (crawl, URL/file import, geocode, visibility change, aggregate restore) emit public_safety.admin_operation.v1 with only UTC time, fixed action and actual HTTP status. Hide/unhide distinguishes record vs source but never records target ID, name or source title. Keep at most 100 recent events in memory and show the latest 20 in the disclosure; emit at most 100 audit events per five-minute bucket. Log backpressure or caps can omit events; skipped counts are reported. No named administrator identity or tamper-evident ledger, no audit-event restoration. A shared token cannot establish individual accountability. Existing host log retention is outside the module. Denied authentication remains aggregate-only. Successful report reads do not inflate request counts.

Investigation indicators: count recorded buckets with at least 10 successful GET CSV responses or at least 5 denied admin requests, count handler 5xx responses, and indicate observed/logging limits. These are fixed descriptive thresholds, not learned baselines, per-client patterns or proven incidents. No automatic blocking or access-policy changes. No additional source identity, geo enrichment, external calls, database, paid infrastructure or scheduled jobs. No real records or visibility settings are changed by this release.
