# Operations

## Local Setup

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run dev
```

## Import Commands

```bash
python3 scripts/crawl_sources.py
python3 scripts/import_pdf.py --url "<PDF_URL>"
python3 scripts/import_pdf.py --file ./path/to/file.pdf
python3 scripts/geocode_locations.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
```

## Admin UI

Start the app, set `ADMIN_TOKEN` to a non-default secret value, then open `/admin`. Admin import routes and import logs require the `x-admin-token` header. Missing tokens and the placeholder value `change-me` are rejected.

## Geocoding

Use Nominatim only during import/maintenance flows. Queries are normalized as `臺北市 {locationText}` and cached in SQLite. Do not geocode on page load.

## Source Politeness

Crawler requests use a descriptive User-Agent, sequential requests, and delay between pages. Do not bypass access controls or aggressively parallelize government site access.

## Known Risks

- PDF table formats may vary and require manual review.
- PyMuPDF is available as a future fallback, but the current parser path is `pdfplumber` plus text fallback.
- Live import and geocoding require network access and can fail independently of the dashboard.
- Local Lighthouse/e2e server startup may require localhost binding permission in sandboxed environments.
