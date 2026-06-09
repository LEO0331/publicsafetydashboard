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

## Alternatives And Tradeoffs

| Area | Current Choice | Alternatives Considered | Tradeoff |
| --- | --- | --- | --- |
| Frontend framework | Next.js App Router | Vite SPA, Astro, SvelteKit, Remix | Next.js keeps API routes and UI in one deployable app. A Vite SPA would be simpler for static UI but would still need a separate backend. Astro is strong for content sites but less natural for admin/API workflows. Remix/SvelteKit are viable but add less value for this small team/project than using the common Next.js ecosystem. |
| API layer | Next.js Route Handlers | Express/Fastify server, Python FastAPI, serverless functions | Route Handlers reduce moving parts. Express/Fastify would provide more backend control but require another server boundary. FastAPI would align with ingestion scripts but split the TypeScript frontend and Python API into two services. Serverless functions do not fit SQLite local files and Python PDF parsing well. |
| Database | SQLite | Postgres, MySQL, managed document DB, static JSON only | SQLite is cheap, transparent, and enough for small educational datasets. Postgres is better for concurrent writes, durable cloud hosting, and multiple admins, but adds service cost and operational setup. Static JSON would be easiest to host but would not support admin imports, review flags, or geocode-cache updates. |
| ORM/migrations | Drizzle | Prisma, raw SQL only, Kysely | Drizzle gives schema ownership and migrations with low overhead. Prisma is polished but heavier and previously added unnecessary moving parts for this local-first SQLite app. Raw SQL is simple but loses typed schema documentation. Kysely is good for typed queries but does not own migrations as directly. |
| PDF parsing language | Python | JavaScript PDF libraries, manual CSV entry, OCR pipeline | Python has stronger practical tooling for messy PDF tables. JavaScript would reduce language count but is weaker for this parsing use case. Manual CSV is reliable but defeats the import/crawler goal. OCR would support scanned documents later but adds complexity and accuracy risk. |
| PDF parser | `pdfplumber` + text fallback | Camelot/Tabula, PyMuPDF-only, OCR | `pdfplumber` works well for text-based tables and is easy to test. Camelot/Tabula can be strong but require extra system dependencies. PyMuPDF is useful as a fallback but not as table-focused. OCR should be a later option only if announcements become scanned images. |
| Mapping | Leaflet + OSM tiles | Google Maps, Mapbox, no map, server-rendered static map | Leaflet/OSM avoids paid APIs and vendor lock-in. Google/Mapbox provide richer geocoding and tiles but introduce cost, keys, and policy constraints. No map would be simpler but weaker for education. Static maps would be fast but less interactive. |
| Geocoding | Nominatim cached during import | Paid geocoder, local geocoder, manual coordinate CSV | Nominatim is free/open but rate-limited and unreliable from shared cloud IPs. Paid geocoders are more reliable but conflict with the low-cost goal. A local geocoder is heavy. Manual/local exported cache is the best free deployment fallback. |
| Deployment | Docker full-stack service | GitHub Pages, Vercel, separate frontend/backend, managed Kubernetes | Docker matches the Node + Python + SQLite shape. GitHub Pages cannot run the backend. Vercel is excellent for many Next apps but not this local-file SQLite/Python ingestion model. Separate services or Kubernetes are unnecessary for the first version. |
| Admin security | Single `ADMIN_TOKEN` | Full user login, OAuth, no admin UI | A token is sufficient for a single-operator educational demo. Full auth is better for teams and audit trails but adds account/security surface. No admin UI would force command-line operation and make hosted demos harder to maintain. |
| Test stack | Built-in Python/Node tests + Playwright + Lighthouse | Jest/Vitest, Cypress, no browser tests | Built-in runners avoid extra dependencies while covering core logic. Playwright validates real browser/API/database behavior. Jest/Vitest would be useful for complex frontend unit tests later. Cypress is viable but less aligned with current CI/browser tooling. |

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
