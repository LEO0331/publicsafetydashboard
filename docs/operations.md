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
python3 scripts/geocode_locations.py --limit 5 --delay 10
python3 scripts/export_geocode_cache.py
python3 scripts/seed_geocode_cache.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
npm run seed:initial
npm run export:geocode
npm run seed:geocode
```

`npm run seed:initial` imports the bundled starter dataset parsed from the 115.04.22 and 115.05.27 Taipei DOT public PDF announcements. It stores parsed rows only; original PDF binaries/photos are not bundled.

`npm run seed:geocode` imports `data/seed/geocoded_locations.json`. The committed seed contains approximate local-demo coordinates for bundled starter locations so the public demo map works immediately after deployment.

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

## CSV Export

The dashboard CSV export uses the same public filters as `/api/records` and excludes hidden records/sources. It exports only fields already shown in the educational UI. CSV cells are sanitized to prevent spreadsheet formula execution when opened in desktop spreadsheet tools.

## Geocoding Operations

Geocoding is a maintenance action, not a page-load behavior.

Rules:

- Query format is `臺北市 {locationText}`.
- Send only location text, never names or violation facts.
- Cache every result in `geocoded_locations`.
- Stop a batch after the first Nominatim `429 Too many requests`.
- Use small batches and long delays on shared cloud hosts.

Render free often shares outbound IPs with other users, so prefer this workflow for map data:

1. Import the same PDFs locally.
2. Run `python3 scripts/geocode_locations.py --limit 5 --delay 10` until needed locations are cached.
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
- `.github/workflows/deploy.yml`: builds and publishes a Docker image to GitHub Container Registry after CI passes on `main`, or manually through `workflow_dispatch`.

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
