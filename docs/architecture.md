# Architecture

## Purpose

The app is a local-first educational dashboard for Taipei City Government public drunk/drug driving repeat-offender PDF announcements. It collects public PDF sources, parses tabular records, stores normalized data in SQLite, and displays summary, table, filter, and map views.

## Runtime Boundaries

- `app/`: Next.js App Router pages and API route handlers.
- `src/components/`: reusable client-side UI components.
- `src/server/`: server-side SQLite query and admin helpers used by API routes.
- `src/db/`: Drizzle schema and local SQLite client wiring.
- `scripts/`: Python ingestion, parsing, crawling, geocoding, and maintenance scripts.
- `drizzle/`: SQLite migrations and local database outputs.
- `e2e/`: Playwright browser tests and fixture database seeding.

## Data Flow

1. `scripts/crawl_sources.py` discovers PDF URLs from the Taipei DOT listing page.
2. `scripts/import_pdf.py` downloads or copies a PDF, calculates a stable content hash, and parses records.
3. `scripts/pdf_parser.py` uses `pdfplumber` table extraction first, then a text-row fallback.
4. Parsed records are stored in SQLite tables defined by `src/db/schema.ts`.
5. API routes in `app/api/*` read SQLite through `src/server/queries.ts`.
6. The dashboard calls API routes from client components and renders summaries, filters, table rows, and grouped map data.

## Database Tables

- `sources`: one row per source announcement/PDF.
- `offender_records`: parsed violation rows linked to `sources`.
- `geocoded_locations`: cached geocode results keyed by normalized location query.

## API Surface

- `GET /api/stats`
- `GET /api/records`
- `GET /api/locations`
- `POST /api/import/crawl`
- `POST /api/import/pdf-url`
- `POST /api/import/pdf-file`
- `GET /api/import/logs`

Admin import and log endpoints require `x-admin-token`. The token must be configured through `ADMIN_TOKEN`; the placeholder value `change-me` is rejected.

## Privacy Boundary

The app does not enrich offender records. Geocoding sends only location text, never names or violation facts. Photos are not displayed by default.
