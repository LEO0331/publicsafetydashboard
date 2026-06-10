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

## 2026-06-08 (Bilingual UI, cleanup, and map explorer update)

### Completed
- Added persisted Traditional Chinese / English frontend language switching across dashboard and admin UI.
- Centralized bilingual copy, localStorage language persistence, date formatting, violation-count formatting, and violation-type labels in `src/components/uiLanguage.ts`.
- Extracted repeated language-toggle markup into `src/components/LanguageToggle.tsx`.
- Reworked the map tab into a ranked/searchable grouped-location explorer to avoid overwhelming users with too many pins.
- Replaced equal-density map pins with scaled grouped circles and a side list showing exact place, incident count, date range, and type breakdown.
- Tightened map coordinate filtering to check explicit `null` values instead of coordinate truthiness.
- Updated architecture, design, testing, feature tracker, and session handoff docs for the current implementation.

### Verification evidence
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed: 15 Python unit tests and 4 Node integration tests.
- `npm run test:coverage` passed: Python tracked modules 83.93% line coverage; Node server/integration coverage 97.76% line coverage.
- `npm run test:e2e` passed with bundled Node runtime: 8 Playwright tests.
- Production Next build passed as part of `npm run test:e2e`.
- `npm audit --audit-level=high` completed and reported dependency vulnerabilities requiring a dedicated upgrade pass.

### Remaining risks / gaps
- `npm audit --audit-level=high` reports high vulnerabilities in `drizzle-orm`, transitive `effect`/Prisma tooling, and `tmp` via Lighthouse tooling. Several suggested fixes are breaking upgrades and were not applied during this cleanup/map pass.
- `.omx/` runtime state files are modified locally but were intentionally ignored per user instruction.
- Local production build/E2E may need the bundled Node runtime because the default local Node can be below Next's required version; rebuild `better-sqlite3` afterward for the default runtime.

### Next action
- If release-blocking dependency hygiene is required, run a dedicated dependency-upgrade pass for Drizzle, Next/PostCSS advisories, and Lighthouse/transitive tooling, then rerun full CI gates.

## 2026-06-09 (Frontend pagination and harness review)

### Current State
- Core dashboard remains implemented and deployable on Render.
- Frontend records pagination is now exposed instead of showing only the first 50 filtered records.
- Harness lifecycle/state docs were updated after `harness-creator` validation.

### Completed
- Added fixed-size frontend pagination for dashboard records: bilingual summary, previous/next controls, disabled boundary states, and filter reset to page 1.
- Added API pagination offset regression coverage in the Node integration tests.
- Updated Playwright E2E assertions for Traditional Chinese and English pagination summaries.
- Updated `feature_list.json` with validator-friendly `name`, `description`, and `dependencies` fields plus F08 evidence.
- Updated `AGENTS.md` startup/end-of-session workflow and `session-handoff.md` restart markers.
- Added bilingual `docs/agent-harness*` documentation and linked it from the docs index.
- Fixed `scripts/check-node-coverage.mjs` so it accepts current Node coverage summary output while preserving the 80% gate.

### Verification evidence
- `node /Users/Leo/.agents/skills/harness-creator/scripts/validate-harness.mjs --target /Users/Leo/Documents/publicsafetydashboard` initially reported `68/100`; lifecycle was the bottleneck.
- `node /Users/Leo/.agents/skills/harness-creator/scripts/validate-harness.mjs --target /Users/Leo/Documents/publicsafetydashboard` passed after updates: `100/100`.
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 18 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:coverage` passed: Python tracked modules 83.23% line coverage; Node tracked files 97.83% line coverage.
- `PATH=/opt/homebrew/bin:$PATH npm run test:e2e` passed with elevated localhost permission: 8 Playwright tests.

### Remaining risks / gaps
- Local `/usr/local/bin/node` is `20.2.0`, below Next.js `>=20.9.0`; use a supported Node runtime for build/E2E.
- Switching Node runtimes can require `npm rebuild better-sqlite3` because SQLite uses a native module.
- Dependency audit findings remain deferred to a dedicated dependency-upgrade pass.
- `.omx/` runtime state files are modified locally but intentionally ignored per user instruction.

### Next action
- Rerun `./init.sh` with a supported Node runtime before final publish/merge, then commit the scoped app, test, and harness changes.

## 2026-06-10 (Demo map geocode seed)

### Current State
- The bundled 50-record starter dataset now has a committed map coordinate cache for all unique starter locations.
- The map still displays grouped locations with top-location folding; it does not show one marker per person.

### Completed
- Added 32 `local-demo-seed` cached coordinates to `data/seed/geocoded_locations.json`, covering every unique `locationText` in the starter records.
- Added a unit regression that compares starter record locations against the geocode seed and verifies the seed inserts into a migrated SQLite database.
- Updated public README and deployment/operations docs in English and Traditional Chinese to explain the demo geocode cache and Render behavior.

### Verification evidence
- `python3 -m json.tool data/seed/geocoded_locations.json` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:coverage` passed: Python tracked modules 83.23% line coverage; Node tracked files 97.83% line coverage.
- `PATH=/opt/homebrew/bin:$PATH npm run test:e2e` passed with elevated localhost permission: 8 Playwright tests.

### Remaining risks / gaps
- Demo coordinates are approximate road/landmark centroids for visualization, not authoritative geocoding results.
- Additional imported PDFs still need `/admin` geocoding or a refreshed committed geocode cache.

### Next action
- Redeploy Render so startup runs `scripts/seed_geocode_cache.py` and imports the committed demo map cache.

## 2026-06-10 (Publish readiness utilities)

### Current State
- The dashboard now includes lightweight publish-readiness utilities beyond the original F01-F07 scope.
- Admin correction behavior remains reversible through `is_hidden`; no delete workflow was added.

### Completed
- Added data freshness and rows-needing-review summary to `/api/stats` and the dashboard.
- Added filtered CSV export at `/api/records/export.csv`.
- Added admin-only `/api/admin/review` and `/api/admin/hide` routes.
- Added admin UI sections for review rows and source hide/unhide maintenance.
- Added a map legend explaining grouped circles, size encoding, and approximate demo coordinates.
- Added `docs/superpowers/plans/2026-06-10-publish-readiness-features.md`.
- Updated README and operations docs in English and Traditional Chinese.

### Verification evidence
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:coverage` passed: Python tracked modules 83.23% line coverage; Node tracked files 98.31% line coverage.
- `PATH=/opt/homebrew/bin:$PATH npm run test:e2e` passed with elevated localhost permission: 9 Playwright tests.

### Remaining risks / gaps
- Admin hide/unhide is intentionally basic and token-protected; it is suitable for a demo/admin utility, not a full audit workflow.
- CSV export is public and intentionally limited to table fields already shown in the dashboard.
- Dependency audit findings remain deferred to a dedicated dependency-upgrade pass.

### Next action
- Run `./init.sh` with a supported Node runtime before committing, then redeploy Render.

## 2026-06-10 (Whole-project code review fixes)

### Current State
- Whole-project code review completed after the publish-readiness feature batch.
- No critical application defects remain in the reviewed code paths.

### Completed
- Hardened CSV export against spreadsheet formula injection by prefixing formula-like cell values before CSV escaping.
- Tightened `/api/admin/hide` validation so `hidden` must be a real boolean; string values such as `"false"` no longer coerce to `true`.
- Corrected data freshness so latest source dates are computed from visible sources, including visible sources with zero parsed rows.
- Made admin action loading state fail-safe with `try/catch/finally`.
- Ran non-force `npm audit fix`, which updated lockfile resolutions and reduced high advisories from 5 to 2. Next resolved to 16.2.9.

### Verification evidence
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:coverage` passed: Python tracked modules 83.23% line coverage; Node tracked files 98.35% line coverage.
- `PATH=/opt/homebrew/bin:$PATH npm run test:e2e` passed with elevated localhost permission: 9 Playwright tests.
- `PATH=/opt/homebrew/bin:$PATH npm audit --audit-level=high` still reports 2 high advisories requiring force/breaking upgrades.

### Remaining risks / gaps
- `drizzle-orm <0.45.2` high advisory remains; `npm audit` suggests `--force` and a breaking upgrade. Current app uses parameterized raw SQL and does not interpolate user-controlled identifiers, but this should still be handled in a dedicated dependency-upgrade pass.
- `tmp <=0.2.5` high advisory remains through Lighthouse tooling; `npm audit` suggests force-downgrading `@lhci/cli`, so this also needs a dedicated toolchain upgrade/replacement pass.
- Moderate advisories remain in dev/build tooling (`@hono/node-server` via Prisma optional tooling, esbuild via drizzle-kit, postcss via Next nested dependency, uuid via Lighthouse tooling).

### Next action
- Run `./init.sh` with a supported Node runtime, then commit and redeploy. Schedule a dedicated dependency-upgrade pass for Drizzle and Lighthouse tooling.

## 2026-06-10 (Docs and root structure cleanup)

### Current State
- Docs folder was consolidated to reduce overlapping files while preserving English and Traditional Chinese coverage.
- Root `.ts`, `.mjs`, `.cjs`, and `.json` config files were reviewed and intentionally left at the repository root because the relevant tools discover them there.

### Completed
- Merged architecture, design, project structure, tech-stack rationale, alternatives, and system-level tradeoffs into `docs/architecture.md` and `docs/architecture.zh-TW.md`.
- Merged operations, deployment, testing, CI, geocoding maintenance, and incident response into `docs/operations.md` and `docs/operations.zh-TW.md`.
- Updated docs indexes and root README links to point to the consolidated docs.
- Removed redundant split documentation files after consolidation.
- Updated `session-handoff.md` so future sessions reference the consolidated docs.

### Verification evidence
- Stale docs link scan passed for removed docs paths.
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run build` passed and produced expected static pages plus dynamic API routes.
- `PATH=/opt/homebrew/bin:$PATH ./init.sh` passed, including lint, typecheck, test, and coverage gates.

### Remaining risks / gaps
- No runtime root config files were moved; moving them would require tool-specific config overrides and would increase deployment risk.
- `.omx/` runtime state remains ignored for project cleanup decisions.

## 2026-06-10 (Whole-project deslop pass)

### Current State
- Whole-project cleanup ran after docs consolidation and code-review fixes.
- Existing behavior was locked before edits with lint, typecheck, and unit/integration tests.

### Completed
- Removed duplicated admin refresh logic in `app/admin/page.tsx` by centralizing log/review/source loading into one typed helper.
- Kept admin JSON handling defensive so failed or malformed admin responses clear admin lists instead of throwing into the UI.
- Added an invalid-pagination regression assertion for `/api/records` server query behavior.
- Centralized positive integer parsing in `src/server/queries.ts` so invalid `page`/`pageSize` strings fall back safely instead of reaching SQLite as `NaN`.
- Scanned app/source/test/script files for obvious debug leftovers, TODO markers, broad suppressions, and placeholder slop. No additional safe deletion targets were found.

### Verification evidence
- Regression test failed before the query fix with `SQLITE_MISMATCH`, confirming the pagination gap.
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:coverage` passed: Python tracked modules 83.23% line coverage; Node tracked files 98.39% line coverage.
- `PATH=/opt/homebrew/bin:$PATH npm run build` passed and produced expected dynamic API routes.
- `PATH=/opt/homebrew/bin:$PATH ./init.sh` passed, including lint, typecheck, test, and coverage gates.

### Remaining risks / gaps
- `PATH=/opt/homebrew/bin:$PATH npm audit --audit-level=high` still fails with 2 high advisories (`drizzle-orm`, `tmp` through Lighthouse tooling) plus moderate dev/build advisories. These require a separate dependency/toolchain upgrade pass because suggested fixes are breaking or force downgrades.
- E2E was not rerun in this deslop pass because the edits are server pagination normalization and admin fetch refactoring already covered by integration tests and prior e2e coverage.

## 2026-06-10 (Short-loop reliability upgrades)

### Current State
- Two bounded improvement loops were run after the project was already passing normal gates.
- Scope stayed limited to API response hygiene and admin import request robustness.

### Completed
- Added `src/server/http.ts` with shared `jsonNoStore`, `noStoreHeaders`, and defensive JSON object parsing helpers.
- Applied explicit `Cache-Control: no-store` to public dashboard APIs, CSV export, admin APIs, import logs, and admin authorization failures.
- Hardened JSON import routes so malformed JSON or non-object bodies are handled through normal validation paths instead of surfacing as server errors.
- Tightened `/api/import/pdf-url` validation so URL must be a non-empty string and title falls back only when it is not a usable string.
- Added Playwright assertions that records, locations, CSV export, admin review, unauthorized logs, invalid hide, and malformed PDF URL import responses include `no-store`.

### Verification evidence
- `PATH=/opt/homebrew/bin:$PATH npm run lint` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run typecheck` passed.
- `PATH=/opt/homebrew/bin:$PATH npm test` passed: 19 Python unit tests and 4 Node integration tests.
- `PATH=/opt/homebrew/bin:$PATH npm run test:e2e` passed: 9 Playwright tests.
- `PATH=/opt/homebrew/bin:$PATH ./init.sh` passed, including lint, typecheck, test, and coverage gates.

### Remaining risks / gaps
- No dependency upgrades were attempted in this short-loop pass.
- HTTP helper coverage is enough for current gates, but direct unit tests for `readJsonObject` can be added later if that helper grows.
