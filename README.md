# Taipei Public Safety Dashboard

Full-stack educational dashboard for Taipei public traffic-safety PDF announcements, with Next.js, SQLite, Python ingestion, filters, stats, and map visualization.

Educational dashboard for Taipei City Government public drunk/drug driving repeat-offender PDF announcements.

Primary source:
https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170

## Setup

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run dev
```

Local app:
http://localhost:3000

## Documentation

- [Architecture](./docs/architecture.md)
- [Design](./docs/design.md)
- [Testing](./docs/testing.md)
- [Operations](./docs/operations.md)
- [Deployment](./docs/deployment.md)
- [Project Structure](./docs/project-structure.md)
- [繁體中文 README](./README.zh-TW.md)

## Import Data

Crawl the Taipei DOT listing page:

```bash
python3 scripts/crawl_sources.py
```

Import one PDF URL:

```bash
python3 scripts/import_pdf.py --url "<PDF_URL>"
```

Import one local PDF:

```bash
python3 scripts/import_pdf.py --file ./path/to/file.pdf
```

Seed with the example PDF URL:

```bash
python3 scripts/seed_example.py
```

Geocode cached locations:

```bash
python3 scripts/geocode_locations.py
```

Rebuild all:

```bash
python3 scripts/rebuild_all.py
```

## Admin Import UI

Set `ADMIN_TOKEN` in `.env` to a non-default secret value, start the app, then open:

http://localhost:3000/admin

Admin endpoints, including import logs, require the `x-admin-token` header. The server rejects missing tokens and the placeholder value `change-me`.

## Privacy And Safety

本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。

Rules enforced by design:

- No enrichment from non-government sources.
- No face recognition.
- No social-media scraping.
- Photos are not displayed by default.
- Geocoding sends only location text, prefixed with Taipei City context.
- Map pins are grouped by location, not by individual person.
- Name search is not part of the default dashboard flow.

## API

- `GET /api/stats`
- `GET /api/records?violationCount=&type=&location=&dateFrom=&dateTo=&page=&pageSize=`
- `GET /api/locations`
- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `GET /api/import/logs`

## Verification

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

The e2e command seeds `drizzle/e2e.db`, builds the app, starts it on `http://127.0.0.1:3100`, and runs Playwright against the real Next.js/API/SQLite boundary.
The coverage command enforces at least 80% line coverage for tracked Python ingestion modules and Node server integration code.
The Lighthouse command seeds the same deterministic database, builds the app, starts it on `http://127.0.0.1:4173`, and audits `/` plus `/admin` with score gates for Performance, Accessibility, Best Practices, and SEO.

## Deployment

Live Render deployment:

https://publicsafetydashboard.onrender.com

GitHub Actions publishes a Docker image to GHCR after CI passes on `main`, and it can also be run manually from the Actions tab. See [Deployment](./docs/deployment.md) for Render setup, the GHCR image flow, required environment variables, and storage notes.

On Render, leave the service `Start Command` blank so the Dockerfile runs `scripts/start-render.sh`. If Render exits with status `127`, remove any custom Start Command and redeploy.

## Known Limitations

- PDF table formats may vary across announcements; incomplete rows are retained with `needsReview=true`.
- `pdfplumber` is the primary parser. PyMuPDF is listed as a fallback dependency for future parser hardening.
- Nominatim geocoding is rate-limited and cached; it should be run during import, not on page load.
- Local SQLite is the target for the first version. Cloud deployment is intentionally optional.
