# Resume Deep Dive Briefing

## One-Line Project Pitch

Built a bilingual full-stack educational dashboard that ingests Taipei City Government public repeat-offender PDF announcements, parses them into SQLite, and visualizes traffic-safety patterns with filters, stats, and grouped maps.

## Resume Bullets

- Built a Next.js/TypeScript public-safety dashboard with SQLite-backed APIs, bilingual UI, filterable records, summary statistics, and Leaflet/OpenStreetMap location visualization.
- Implemented Python PDF ingestion pipeline with crawler, one-PDF importer, `pdfplumber` table extraction, text fallback, parser confidence, and manual-review flags.
- Designed privacy-preserving geocoding flow that sends only location text, caches coordinates, handles Nominatim rate limits, and supports local cache export for Render free deployments.
- Added CI quality gates with lint, typecheck, Python/Node tests, coverage enforcement, Playwright e2e flows, Lighthouse audits, and Docker image publishing.
- Documented architecture, tech-stack tradeoffs, incident response, deployment workflow, and bilingual public-facing usage guides.

## Architecture Talking Points

- One deployable Next.js app owns public UI, admin UI, and API endpoints.
- Python is isolated to ingestion scripts because PDF parsing is easier and more reliable in that ecosystem.
- SQLite keeps the project local-first and cheap for educational usage.
- Geocoding is import-time only, cached, and location-only for privacy.
- Map visualization groups by location, not individual, to avoid people-tracking behavior.
- Admin functions use a simple environment token because the first version has one operator and no account system.

## Deep-Dive Questions And Strong Answers

### Why not make it a static site?

Because the project needs server-side imports, SQLite queries, upload handling, logs, and admin endpoints. A static site could show prebuilt JSON, but it would lose the import/admin workflows and geocode cache updates.

### Why SQLite instead of Postgres?

SQLite matches the first-version constraints: small dataset, local-first setup, simple backup, and low cost. The tradeoff is durability and concurrency on cloud hosts. For serious multi-user production, the documented migration path is Postgres.

### Why use Python in a Next.js project?

PDF table parsing is the riskiest part. Python has mature tooling like `pdfplumber`, and the scripts are isolated behind CLI/admin actions, so the runtime boundary is clear and testable.

### How did you handle privacy risk?

The app does not enrich records, scrape social media, infer identities, or display photos by default. Geocoding sends only location text. The map groups incidents by place instead of person. The UI uses neutral education wording and keeps name search out of the default workflow.

### What was a real production issue?

Nominatim returned HTTP 429 from Render shared IPs. The fix was to stop the batch on first 429, retry failed rows later, default to small slow batches, and add a local geocode export/import cache for Render free deployments.

### How do you know it works?

The project has Python unit tests for parser/geocoder/seed behavior, Node integration tests for API query/admin auth behavior, Playwright e2e tests for dashboard/admin/map flows, coverage gates above 80%, and Lighthouse CI for performance/accessibility/SEO.

### What would you improve next?

Move durable production deployments to persistent disk or Postgres, add full admin authentication if multiple operators exist, add better parser fixtures from more real PDFs, and create a background worker queue for long imports/geocoding.

## System Design Diagram

```text
Taipei DOT source page / PDF URL / local PDF
        |
        v
Python crawler/importer/parser scripts
        |
        v
SQLite tables: sources, offender_records, geocoded_locations
        |
        v
Next.js API routes: stats, records, locations, import/admin
        |
        v
Bilingual dashboard: summaries, filters, table, grouped map
```

## Key Tradeoff To Emphasize

This is not an over-engineered enterprise system. It is intentionally scoped as an educational, local-first data product with clear privacy boundaries. The strongest engineering decisions are in the boundaries: server vs ingestion scripts, import-time geocoding vs page-load geocoding, grouped map vs individual pins, and seed/cache workflows for low-cost deployment.
