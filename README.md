# Taipei Repeat DUI / Drug-Impaired / Test-Refusal Education Dashboard

A bilingual public-safety education dashboard built from Taipei City Government public PDF announcements. The project helps students and educators explore repeat drunk-driving, drug-impaired driving, and test-refusal announcement data through summaries, filters, tables, and grouped location maps.

Live demo:

https://publicsafetydashboard.onrender.com

Primary public source:

https://dot.gov.taipei/News.aspx?n=8E3A7133A22A0C79&sms=97D77E8D19D60170

Traditional Chinese README:

[README.zh-TW.md](./README.zh-TW.md)

## What This Project Does

- Imports Taipei DOT public announcement PDFs from a crawler, PDF URL, or local PDF upload.
- Parses repeat-offender table rows into a local SQLite database.
- Shows total records, imported announcements, repeat-count distribution, violation-type distribution, and frequent locations.
- Shows data freshness and parser rows needing review.
- Supports filters for violation type, repeat count, date range, and location keyword.
- Exports filtered public table data as CSV.
- Provides a bilingual Traditional Chinese / English frontend.
- Shows a map by grouped location, not by individual person.
- Uses cached geocoding only; the dashboard never geocodes on page load.
- Provides admin maintenance tools for import logs, review rows, and reversible source/record hiding.

## Public-Safety And Privacy Notice

本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。

This project intentionally avoids turning public records into a people-search product:

- No enrichment from other sources.
- No social-media scraping.
- No face recognition.
- Photos are not displayed by default.
- Geocoding sends only location text, never names or violation facts.
- Map points are grouped by location.
- Public record values are preserved as published and are not translated or modified.

## Quick Start

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run seed:initial
npm run dev
```

Open:

```text
http://localhost:3000
```

Admin page:

```text
http://localhost:3000/admin
```

Set a non-default admin token before using import actions:

```bash
ADMIN_TOKEN="<strong-secret>"
```

## Data Import

Seed bundled starter records from 13 same-format public Taipei DOT announcements on the current first listing page:

```bash
npm run seed:initial
```

Crawl Taipei DOT source pages:

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

## Map Coordinates

The bundled starter dataset includes a local demo geocode cache for selected starter locations, so the deployed demo map can render grouped location circles without calling Nominatim from Render. Newly imported or newly seeded locations can be geocoded later from `/admin` or with `scripts/geocode_locations.py`.

The map uses cached coordinates in `geocoded_locations`. Imported PDF records do not automatically have latitude/longitude.

Local geocoding:

```bash
python3 scripts/geocode_locations.py --limit 5 --delay 10
```

For Render free deployments, prefer local geocoding and export the cache:

```bash
npm run export:geocode
git add data/seed/geocoded_locations.json
git commit -m "Seed geocoded map locations"
git push
```

Render startup imports that cache automatically through `scripts/seed_geocode_cache.py`, avoiding Nominatim calls from Render shared IPs.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS.
- Backend/API: Next.js Route Handlers.
- Database: SQLite with Drizzle migrations.
- Ingestion: Python scripts using `pdfplumber` plus text fallback.
- Map: Leaflet, React Leaflet, OpenStreetMap tiles.
- Testing: Python `unittest`, Node test runner, Playwright, Lighthouse CI.
- Deployment: Docker image published by GitHub Actions; Render-compatible startup script.

See [Architecture, Design, And Tradeoffs](./docs/architecture.md) for why these choices fit this project.

## Documentation

- [Architecture, Design, And Tradeoffs](./docs/architecture.md)
- [Operations, Deployment, Testing, And Incidents](./docs/operations.md)
- [Agent Harness](./docs/agent-harness.md)
- [Resume Deep Dive Briefing](./docs/resume-deep-dive.md)
- [Traditional Chinese Docs](./docs/README.zh-TW.md)

## API Endpoints

- `GET /api/stats`
- `GET /api/records?violationCount=&type=&location=&dateFrom=&dateTo=&page=&pageSize=`
- `GET /api/locations`
- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `POST /api/import/geocode`
- `GET /api/import/logs`

Admin import endpoints require `x-admin-token`.

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

## Deployment Notes

The complete app needs Next.js API routes, SQLite, Python PDF parsing, uploads, logs, and admin endpoints. Deploy it as a Docker/Node service rather than a static site.

Recommended durable deployment:

- Render paid web service with persistent disk.
- Fly.io with volume.
- Railway or VPS with persistent filesystem.

Render free works for demos, but SQLite data and uploaded files can reset after restarts or redeploys.

## Known Limitations

- PDF layouts may change; incomplete parsed rows are retained with `needsReview=true`.
- Nominatim can rate-limit cloud providers. Use cached/local geocoding for deployment.
- SQLite is intentionally local-first. A multi-user production system may eventually need Postgres or another managed database.
