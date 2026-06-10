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
python3 scripts/export_geocode_cache.py
python3 scripts/seed_geocode_cache.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
npm run seed:initial
npm run export:geocode
npm run seed:geocode
```

`npm run seed:initial` imports the bundled starter dataset parsed from the 115.04.22 and 115.05.27 Taipei DOT public PDF announcements. It stores parsed rows only; original PDF binaries/photos are not bundled.

`npm run seed:geocode` imports `data/seed/geocoded_locations.json`. The committed seed contains approximate local-demo coordinates for all bundled starter locations so the public demo map is useful immediately after deployment.

## Admin UI

Start the app, set `ADMIN_TOKEN` to a non-default secret value, then open `/admin`. Admin import routes and import logs require the `x-admin-token` header. Missing tokens and the placeholder value `change-me` are rejected.

After importing additional PDFs in a deployed environment, run the `/admin` "Generate Map Coordinates" action to populate `geocoded_locations` for new locations. The map tab only shows places with cached coordinates. This action calls Nominatim once per ungeocoded or previously failed location, respects the configured delay, and sends only location text.

If logs show `HTTP Error 429: Too many requests`, stop and wait before retrying. Render shared outbound IPs can hit Nominatim limits. Use small batches, for example limit `5` and delay `10` seconds. The geocoder stops the current batch after the first 429 and will retry that failed location on the next run.

For Render free, prefer local geocoding:

1. Import the same PDFs locally.
2. Run `python3 scripts/geocode_locations.py --limit 5 --delay 10` until needed locations are cached.
3. Run `npm run export:geocode`.
4. Commit `data/seed/geocoded_locations.json`.
5. Deploy. Render startup runs `scripts/seed_geocode_cache.py` and imports those cached coordinates without calling Nominatim.

## Geocoding

Use Nominatim only during import/maintenance flows. Queries are normalized as `臺北市 {locationText}` and cached in SQLite. Do not geocode on page load.

## Source Politeness

Crawler requests use a descriptive User-Agent, sequential requests, and delay between pages. Do not bypass access controls or aggressively parallelize government site access.

## Known Risks

- PDF table formats may vary and require manual review.
- PyMuPDF is available as a future fallback, but the current parser path is `pdfplumber` plus text fallback.
- Live import and geocoding require network access and can fail independently of the dashboard.
- Local Lighthouse/e2e server startup may require localhost binding permission in sandboxed environments.
