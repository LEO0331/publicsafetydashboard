# Architecture, Design, And Tradeoffs

## Purpose

This project is a local-first educational dashboard for Taipei City Government public repeat drunk-driving, drug-impaired driving, and test-refusal PDF announcements. It imports public PDFs, parses tabular records, stores normalized data in SQLite, and presents summaries, filters, table data, CSV export, and grouped location maps for traffic-safety education.

## Runtime Boundaries

```text
app/                    Next.js App Router pages and API route handlers
src/components/         Reusable React UI components and shared UI language helpers
src/db/                 Drizzle schema and SQLite client wiring
src/server/             Server-only query/admin helpers used by API routes
scripts/                Python crawler, PDF parser, importer, geocoder, and seed utilities
data/seed/              Starter parsed data and geocode cache; no bundled photos
Drizzle/migrations/     SQLite migrations
e2e/                    Playwright browser tests and fixture database seeding
tests/                  Python unit tests and Node integration tests
docs/                   Durable architecture, operations, harness, and portfolio notes
.github/workflows/      CI and Docker image publishing workflows
```

Root configuration files stay at the repository root because their tools expect them there: `package.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.mjs`, `tsconfig.json`, `playwright.config.ts`, `lighthouserc.cjs`, and `drizzle.config.ts`. Harness files also stay at root for agent startup: `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, and `init.sh`.

Generated local artifacts such as `.next/`, `node_modules/`, `test-results/`, `tsconfig.tsbuildinfo`, `.env`, and `drizzle/dev.db` are ignored and should not be committed.

## Data Flow

1. `scripts/crawl_sources.py` discovers PDF URLs from Taipei DOT listing pages.
2. `scripts/import_pdf.py` downloads or copies a PDF, calculates a content hash, and calls the parser.
3. `scripts/pdf_parser.py` tries `pdfplumber` table extraction first, then falls back to text-row reconstruction.
4. Parsed rows are saved in SQLite tables owned by `src/db/schema.ts` and Drizzle migrations.
5. API routes in `app/api/*` query SQLite through helpers in `src/server/queries.ts`.
6. The dashboard renders summary cards, freshness warnings, filters, paginated records, CSV export, and grouped map data.
7. The map renders cached geocoded locations as grouped places, not person-level pins.

## Data Model

- `sources`: one row per announcement/PDF, including source URL, PDF URL, published date, content hash, parse status, and hidden flag.
- `offender_records`: parsed announcement rows linked to sources, including violation date, location, fact text, parsed violation count/type, alcohol concentration, review flags, and hidden flag.
- `geocoded_locations`: cached geocode rows keyed by normalized Taipei location query.

## API Surface

Public endpoints:

- `GET /api/stats`
- `GET /api/records?violationCount=&type=&location=&dateFrom=&dateTo=&page=&pageSize=`
- `GET /api/records/export.csv`
- `GET /api/locations`

Admin-token endpoints:

- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `POST /api/import/geocode`
- `GET /api/import/logs`
- `GET /api/admin/review`
- `POST /api/admin/hide`

Admin routes require `x-admin-token`. `ADMIN_TOKEN` must be set to a strong non-placeholder value; `change-me` is rejected.

## UI Design

The visual direction is a restrained civic archive: public-record typography, ledger-like panels, neutral traffic-safety wording, and high-density but readable layouts. Traditional Chinese is the default interface language; English is available from the frontend toggle. Public record values remain in the original source language and are not translated.

Accessibility and safety rules:

- Root language is `zh-Hant`.
- Dashboard includes a skip link and visible focus states.
- Name search is not part of the default public workflow.
- Photos are not displayed by default.
- Source attribution and the public-data disclaimer remain visible.

Map design intentionally avoids a pin wall. The map tab uses a ranked, searchable location explorer, scaled grouped circles, type breakdowns, date ranges, and a show-all control for lower-ranked places.

## Tech Choices

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript | One app can serve UI, API routes, and admin pages with explicit data contracts. |
| Styling | Tailwind CSS | Fast responsive UI without a heavy component framework. |
| API | Next.js Route Handlers | Keeps simple backend endpoints near the dashboard while preserving server-only helpers. |
| Database | SQLite | Fits small public datasets, local-first operation, simple backups, and low-cost deployment. |
| Migrations | Drizzle Kit | Typed schema ownership and SQL migrations without a separate DB server. |
| Ingestion | Python scripts | Python PDF tooling is more reliable for messy announcement tables. |
| PDF parsing | `pdfplumber` plus text fallback | Table extraction is attempted first; fallback keeps partial rows for review. |
| Map | Leaflet + OpenStreetMap | No paid map APIs or vendor lock-in. |
| Geocoding | Cached Nominatim maintenance step | Protects privacy and avoids repeated page-load geocoding. |
| Testing | Python unittest, Node test runner, Playwright, Lighthouse CI | Covers parser logic, server queries, browser flows, accessibility, and performance. |
| Deployment | Docker full-stack service | The app needs Node, Python, SQLite, uploads, logs, and migrations in one deployable unit. |

## Alternatives And Tradeoffs

| Area | Current Choice | Alternative | Tradeoff |
| --- | --- | --- | --- |
| Frontend | Next.js | Vite SPA, Astro, Remix, SvelteKit | Next keeps UI and API together. A static SPA would still need a backend. |
| API | Next route handlers | Express/Fastify/FastAPI | Fewer moving parts now; a separate backend gives more control later. |
| Database | SQLite | Postgres/MySQL/static JSON | SQLite is simple and cheap; Postgres is better for concurrent durable production writes. |
| ORM | Drizzle | Prisma/raw SQL/Kysely | Drizzle is light and migration-friendly; raw SQL loses typed schema ownership. |
| PDF language | Python | JavaScript PDF libraries/OCR/manual CSV | Python handles PDF tables better; OCR is a later option for scanned documents. |
| Geocoding | Cached Nominatim | Paid geocoder/local geocoder/manual CSV | Free and privacy-aligned but rate-limited; committed cache is best for Render free. |
| Deployment | Docker service | GitHub Pages/Vercel/serverless | Static/serverless targets cannot run SQLite writes, Python parsing, uploads, and logs well. |
| Admin security | Single token | Full auth/OAuth/no admin UI | Adequate for one operator; move to real auth if multiple admins need audit trails. |

## System-Level Tradeoffs

The system favors transparency, low cost, and educational clarity over enterprise scaling.

- SQLite keeps operations simple, but production durability requires persistent storage. Render free is demo-only because the filesystem is ephemeral.
- Python ingestion makes parsing more reliable, but introduces a two-language codebase. The boundary is kept inside `scripts/` and covered by tests.
- Import-time cached geocoding avoids privacy and latency problems, but maps are empty until coordinates are seeded or generated.
- Public record display requires careful UX. The app uses neutral wording, grouped maps, source attribution, no default name-search workflow, and no photo display.
- Docker deployment is larger than static hosting, but accurately matches the full-stack app shape.

## Migration Paths

If usage grows, the natural upgrades are:

- SQLite to Postgres for durable concurrent writes.
- Python scripts to a background worker queue for long imports.
- Admin token to authenticated admin accounts and audit logs.
- Committed geocode seed to managed cache backups.
- Render free to Render persistent disk, Fly.io volume, Railway volume, or a VPS.

## Privacy Boundary

The app does not enrich offender records from other sources, scrape social media, infer addresses, or perform face recognition. Geocoding sends only normalized location text such as `臺北市 {locationText}`. Names and violation facts are never sent to the geocoder.
