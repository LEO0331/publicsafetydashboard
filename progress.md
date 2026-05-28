# Progress Log

## 2026-05-28

### Current focus
- Bootstrapping harness and execution guardrails.

### Completed
- Added project harness file: `AGENTS.md`.
- Added feature/state tracker: `feature_list.json`.
- Added verification entrypoint: `init.sh`.
- Added session restart aid: `session-handoff.md`.

### Verification evidence
- `./init.sh` executes and reports current repository readiness.

### Open risks / gaps
- Application codebase has not been scaffolded yet.
- Verification commands are currently preflight checks only; they will enforce lint/type/test once tooling exists.

### Next action
- Start F01: scaffold Next.js + TypeScript + Tailwind and SQLite schema.

## 2026-05-28 (F01 completion update)

### Completed
- Scaffolded Next.js App Router + TypeScript + Tailwind baseline.
- Added SQLite schema using Drizzle (`sources`, `offender_records`, `geocoded_locations`).
- Generated and applied initial SQL migration under `drizzle/migrations`.
- Added DB client wiring at `src/db/client.ts`.

### Verification evidence
- `npm run db:generate` passed.
- `npm run db:migrate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build --webpack` passed.
- `./init.sh` passed.

### Notes
- Prisma schema engine failed in this environment; switched to Drizzle ORM (allowed by project spec) to keep F01 unblocked.

### Next action
- Start F02: implement Taipei DOT crawler script with pagination, URL extraction, dedupe, politeness delay, and source logging.

## 2026-05-28 (F02-F07 completion update)

### Completed
- F02: Added Taipei DOT crawler with pagination, PDF extraction, URL dedupe, polite delay, descriptive User-Agent, and source logging.
- F03: Added one-PDF importer and parser with pdfplumber table extraction, text fallback, violation count/type/alcohol parsing, parser confidence, and `needsReview`.
- F04: Added `/api/records`, `/api/stats`, dashboard summary cards, filters, table, source PDF links, and disabled-by-default name search under advanced.
- F05: Added cached Nominatim geocoding script, `/api/locations`, and lazy Leaflet map tab grouped by location.
- F06: Added admin import page and import/log endpoints protected by `x-admin-token`.
- F07: Added seed script, README, and focused Python/Node tests.

### Verification evidence
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed: 7 Python tests and 1 Node API filter test.
- `npm run build` passed with Next.js webpack build.
- `./init.sh` passed and reran lint, typecheck, and tests.

### Remaining risks / gaps
- Real PDF extraction quality still needs validation against several live Taipei announcement PDFs.
- PyMuPDF is listed as a dependency but the implemented parser currently uses pdfplumber plus text fallback.
- Leaflet markers are grouped by shared location records; visual marker clustering can be enhanced later if many geocoded points overlap.
- Nominatim calls require network access and should remain import-time only.

### Next action
- Import the example PDF after installing Python dependencies, then visually inspect parsed `needsReview` rows and map geocoding results.

## 2026-05-28 (E2E coverage update)

### Completed
- Added Playwright e2e harness with isolated SQLite fixture database.
- Added e2e coverage for dashboard stats, table rendering, violation count/type/location filters, grouped location data, map tab visibility, and admin unauthorized import behavior.
- Added stable frontend test selectors for business-critical UI states.

### Verification evidence
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `npm run test:e2e` passed: 3 Playwright tests.

### Remaining risks / gaps
- E2E uses deterministic fixture data rather than live Taipei PDF import to avoid network flakiness.
- A future live-import smoke test can be added behind an explicit opt-in network flag.

## 2026-05-28 (Lighthouse CI update)

### Completed
- Added Lighthouse CI configuration for `/` and `/admin`.
- Added `npm run lighthouse:ci` with deterministic fixture DB seeding, production build, local Next server, and Playwright Chromium discovery.
- Added GitHub Actions CI workflow for install, lint, typecheck, unit/integration tests, Playwright e2e, and Lighthouse CI.
- Improved metadata, viewport/theme color, and dashboard skip-link accessibility.

### Verification evidence
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `npm run lighthouse:ci` passed.
- Lighthouse scores:
  - `/`: Performance 100, Accessibility 100, Best Practices 96, SEO 100.
  - `/admin`: Performance 100, Accessibility 95, Best Practices 96, SEO 100.
- `npm run build` passed.
- `./init.sh` passed.

### Remaining risks / gaps
- Local sandbox may require elevated permission for Lighthouse because it starts a localhost server.
- CI installs Chromium with Playwright before running e2e and Lighthouse.

## 2026-05-28 (Playwright interactive QA update)

### Completed
- Attempted persistent `js_repl` Playwright session for interactive QA.
- Added interactive QA e2e coverage for desktop viewport fit, no page-level horizontal overflow, mobile filtering, and empty-state behavior.
- Re-ran the business-flow e2e suite against a seeded SQLite database and production Next build.

### Verification evidence
- `npm run test:e2e` passed: 5 Playwright tests.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `./init.sh` passed.

### Remaining risks / gaps
- `js_repl` could import Playwright, but Chromium launch was blocked by the current sandbox (`MachPortRendezvousServer ... Permission denied`).
- Functional and visual-fit checks were completed through the repo Playwright runner instead of a persistent `js_repl` browser session.

## 2026-05-28 (Project structure wrap-up)

### Completed
- Moved reusable UI from `components/` to `src/components/`.
- Moved e2e database seeding to `e2e/fixtures/`.
- Split tests into `tests/unit/` and `tests/integration/`.
- Removed unused Prisma placeholder files and direct Prisma dependencies.
- Removed generated Python cache files and empty legacy directories.
- Added `docs/` with architecture, design, testing, operations, and project-structure documentation.
- Updated README, Tailwind config, package scripts, and test imports for the new layout.

### Verification evidence
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `npm run build` passed.
- `npm run test:e2e` passed with elevated localhost binding permission: 5 Playwright tests.
- `npm run lighthouse:ci` passed with elevated localhost binding permission.
- `./init.sh` passed.

### Remaining risks / gaps
- Local e2e still needs localhost binding permission in the sandbox.

## 2026-05-28 (Code review fixes, cleanup, CI/CD, Playwright)

### Completed
- Fixed admin authorization to fail closed when `ADMIN_TOKEN` is missing or left as `change-me`.
- Protected `/api/import/logs` with the same admin token boundary.
- Replaced user-controlled upload filenames with generated safe filenames.
- Removed accidental uniqueness on `sources.source_url` so one listing page can store multiple PDF sources.
- Updated stats and location queries to exclude records from hidden/corrected sources.
- Added migration `0001_known_taskmaster`.
- Added regression coverage for duplicate source pages, hidden sources, protected logs, and core UI flows.
- Added Dockerfile, `.dockerignore`, GitHub Actions deploy workflow, deployment docs, and Traditional Chinese README.
- Added app icon to remove favicon 404 discovered by Playwright CLI.

### Verification evidence
- `npm run db:migrate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `npm run build` passed.
- `npm run test:e2e` passed with elevated localhost binding permission: 6 Playwright tests.
- `npm run lighthouse:ci` passed with elevated localhost binding permission.
- Playwright CLI smoke snapshot loaded the dashboard and reported no console errors after adding `app/icon.svg`.
- `./init.sh` passed.

### Remaining risks / gaps
- Docker is not installed in the local environment, so the Docker image build is covered by CI workflow/config review rather than a local `docker build`.
- Local e2e and Lighthouse still need localhost binding permission in the sandbox.
