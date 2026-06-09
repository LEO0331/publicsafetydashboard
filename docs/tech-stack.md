# Tech Stack Rationale

## Decision Summary

This project is intentionally local-first and education-focused. The stack prioritizes low operational complexity, transparent data handling, and deterministic testing over enterprise-scale infrastructure.

## Chosen Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js App Router + React + TypeScript | One application can serve the dashboard, admin UI, and API routes. TypeScript keeps data contracts explicit. |
| Styling | Tailwind CSS | Fast, consistent layout and responsive UI without adding a larger component framework. |
| API | Next.js Route Handlers | Keeps simple app endpoints close to the frontend while still running server-side code for SQLite and admin actions. |
| Database | SQLite | Fits local-first deployment, small public datasets, easy backups, and simple Render/Fly/VPS operation. |
| Migrations | Drizzle Kit | Provides typed schema ownership and SQL migrations without requiring a separate database server. |
| PDF ingestion | Python scripts | Python has more mature PDF table tooling and is easier to debug for document extraction. |
| PDF parser | `pdfplumber` first, text fallback | Table extraction is attempted first; text fallback preserves partial records for review when PDF layout changes. |
| Map | Leaflet + OpenStreetMap tiles | Avoids paid map APIs and supports a public-interest education use case. |
| Geocoding | Nominatim with cache | Free/open geocoding is acceptable only as an import-time maintenance step with rate limiting and stored results. |
| Testing | Python unittest, Node test runner, Playwright, Lighthouse CI | Covers ingestion logic, API filters, browser flows, accessibility, and performance without heavy test infrastructure. |
| Deployment | Docker + GitHub Actions + Render-compatible startup | The app needs Node, Python, SQLite, local files, and migrations, so a containerized full-stack service is the simplest deployable unit. |

## Why Not A Static Site

The dashboard is not just static content. It needs:

- API routes for filters, stats, locations, and admin import actions.
- SQLite reads and writes.
- Python PDF parsing.
- Upload handling.
- Import logs.
- Admin-token protected operations.

GitHub Pages or a static CDN cannot run these server-side responsibilities.

## Why SQLite

SQLite is appropriate for the first version because:

- The dataset is small and mostly append/update during imports.
- The app is local-first and easy to run by students or teachers.
- Backups are simple: copy one database file plus seed JSON files.
- It keeps deployment cost low.

SQLite should live on persistent storage in production. Render free does not provide persistent disks, so it is acceptable only for demos. For durable hosting, mount persistent storage at `/app/drizzle`, or move to a managed database later.

## Why Python For Ingestion

PDF table parsing is the riskiest part of the project. Python was chosen because:

- `pdfplumber` is practical for table extraction and layout inspection.
- Parser logic can be tested independently from the web app.
- Ingestion can run as a maintenance/admin action rather than on every page load.
- It keeps geocoding and PDF parsing outside the user-facing request path.

## Why Cached Geocoding

The privacy and reliability requirements rule out page-load geocoding:

- Geocoder requests must contain only location text.
- Names and violation facts must never be sent.
- Nominatim is rate-limited and not suitable for repeated UI-triggered requests.
- Cached coordinates make the map fast and reproducible.

For Render free, local geocoding plus `data/seed/geocoded_locations.json` is preferred because shared cloud IPs may receive `429 Too many requests`.

## Why Not Authentication Beyond Admin Token

The public dashboard does not need login. Admin import actions are protected with a simple `ADMIN_TOKEN` because the first version has one operational user and no account model. If multiple administrators or audit trails are needed later, replace this with real authentication and role-based authorization.

## Migration Paths

If usage grows, the intended upgrade paths are:

- SQLite to Postgres for durable multi-user writes.
- Python scripts to a background worker queue for long imports.
- Admin token to authenticated admin accounts.
- JSON geocode seed to managed geocode-cache table backups.
- Render free demo to Render paid disk, Fly.io volume, Railway volume, or VPS.
