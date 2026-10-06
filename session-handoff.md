# Session Handoff

Last Updated: 2026-10-06
Current Objective: fixed monthly refresh verification failing when announcement and geocode seeds grow.
Recommended Next Step: commit the seed-test fix to main, rerun Monthly Taipei DOT refresh, and inspect its generated seed commit and dispatched CI/deployment.

## Latest Fix

- The supplied GitHub Actions log shows that fetching/exporting reached verification: generated seeds had 2,422 records and 497 cache rows, while tests required 2,407 and 490. These frozen totals prevented publication of valid new data.
- `tests/unit/test_ingestion.py` now compares SQLite imports with the current payload and validates privacy, repeated-import idempotency, cache uniqueness, location membership, and mapped/not-found classification.
- Added a synthetic monthly-growth regression with 15 additional records and seven cache rows. Committed seed data and workflow behavior remain unchanged.
- `./init.sh` passed on 2026-10-06 with Git Bash as npm script shell and bundled Python 3.12: lint, typecheck, 30 Python tests, five Node integration tests, Python coverage 85.59%, Node line coverage 96.01%.
- Files changed: `tests/unit/test_ingestion.py`, `feature_list.json`, `progress.md`, `session-handoff.md`.
- No blocker for the local fix. The remote workflow has not been rerun from this session; existing dependency audit findings remain deferred.

## Project

- Taipei public drunk/drug driving repeat-offender educational dashboard.
- Production target: Render full-stack Next.js app at `https://publicsafetydashboard.onrender.com`.

## Current State

- Core F01-F07 implementation is complete.
- App uses Next.js App Router, TypeScript, Tailwind CSS, SQLite, Drizzle migrations, Python ingestion scripts, and Playwright/Lighthouse verification.
- Starter deploy data is bundled in `data/seed/initial_announcements.json` and seeded on Render startup only when the database is empty.
- Frontend supports Traditional Chinese by default and English via a persisted `localStorage` language toggle.
- Map view uses a ranked/searchable grouped-location explorer with scaled circles instead of showing every location as equal-density pins.
- Records API pagination is exposed in the frontend with a fixed page size, previous/next controls, and bilingual page summaries.
- The bundled 2,407-record starter dataset has 412 cached map coordinates so Render can show grouped locations without calling Nominatim.
- Monthly refresh now restores both committed seeds in temporary SQLite, imports only new eligible PDFs, publishes validated announcement data before map enrichment, and uses a bounded 25-query/16-second geocode batch.
- The geocode seed also preserves 78 documented historical `not_found` results without fake coordinates; exports of both seeds are byte-stable after a restore.
- Dashboard shows data freshness and rows needing review, and can export current public filters to CSV.
- Admin page can inspect review rows and hide/unhide sources or records by toggling `is_hidden`; it never deletes records.
- Code review fixes hardened CSV export, admin hide validation, source-based data freshness, and admin error handling.

## Start-Here Checklist

1. Run `./init.sh` for the baseline harness check.
2. Run `npm run lint`, `npm run typecheck`, and `npm test` before making behavioral changes.
3. For frontend/map changes, run `npm run test:e2e` with a supported Node runtime if local Node is below Next's required version.
4. Update `progress.md` with verification evidence and risks after meaningful changes.
5. Ignore `.omx/` runtime state changes unless the user specifically asks to inspect OMX state.

## Important Implementation Notes

- Public source record values should remain as published; do not translate names, locations, PDF titles, or source content.
- Shared bilingual UI copy and formatters live in `src/components/uiLanguage.ts`.
- Shared language toggle markup lives in `src/components/LanguageToggle.tsx`.
- Admin import endpoints require `x-admin-token` and reject missing or placeholder `ADMIN_TOKEN`.
- Geocoding must remain import-time only and send only location text.

## Current Known Risks

- `npm audit --audit-level=high` reports high vulnerabilities in dependencies, including `drizzle-orm`, transitive `effect`/Prisma tooling, and `tmp` through Lighthouse tooling. Several suggested fixes are breaking upgrades and need a dedicated dependency-upgrade pass.
- Local Playwright/Lighthouse runs may need elevated localhost permissions in the Codex sandbox.
- Local default Node may be older than Next requires. Use a Node runtime `>=20.9.0`; if switching Node versions locally, run `npm rebuild better-sqlite3` for that runtime before tests that touch SQLite.

## Blockers

- No active functional blocker.
- Known dependency audit findings remain deferred to a dedicated dependency-upgrade pass.
- Demo geocode coordinates are approximate visualization centroids, not authoritative location geocoding.
- The latest three announcement PDFs can introduce locations not covered by the existing 412 mapped coordinates; they remain safely unmapped until a location-only geocoding refresh is run.
- The new scheduled workflow and live Taipei DOT listing/PDF download have not yet been exercised on GitHub Actions; the first run needs inspection.
- Local `npm ci` on 2026-09-30 reported 28 dependency advisories (1 critical, 15 high, 9 moderate, 3 low). Dependency upgrades need a dedicated, separately verified pass.

## Files

- `.github/workflows/monthly-refresh.yml`, `.github/workflows/ci.yml`: scheduled refresh, generated-file commit, and explicit CI dispatch for bot commits.
- `scripts/refresh_monthly.py`, `scripts/crawl_sources.py`, `scripts/geocode_locations.py`: new-source import flow, year-agnostic semantic title matching, bounded incremental geocoding.
- `scripts/export_geocode_cache.py`, `scripts/seed_geocode_cache.py`, `data/seed/geocoded_locations.json`: deterministic durable mapped and not-found cache.
- `src/server/queries.ts`, `app/api/import/geocode/route.ts`, `src/components/uiLanguage.ts`: map cache reuse and safe admin geocode delay.
- `tests/unit/test_announcement_titles.py`, `tests/unit/test_geocode_incremental.py`, `tests/unit/test_monthly_refresh.py`, `tests/unit/test_ingestion.py`, `tests/integration/api_filters.test.mjs`: regression coverage.
- `README.md`, `docs/operations.md`, `feature_list.json`, `progress.md`: operating guidance and completion evidence.

- `src/components/Dashboard.tsx`: dashboard records pagination controls and page metadata.
- `src/components/uiLanguage.ts`: Traditional Chinese and English pagination copy.
- `tests/integration/api_filters.test.mjs`: direct API pagination offset regression.
- `e2e/dashboard-business-flow.spec.ts`: Traditional Chinese pagination UI regression.
- `e2e/interactive-qa.spec.ts`: English pagination UI regression.
- `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`: harness restart and evidence updates.
- `data/seed/geocoded_locations.json`: committed demo geocode cache for bundled starter locations.
- `README.md`, `README.zh-TW.md`, `docs/architecture*.md`, `docs/operations*.md`: consolidated architecture, deployment, testing, incident, and Render geocode-cache documentation.
- `tests/unit/test_ingestion.py`: geocode seed coverage and migrated SQLite insert regression.
- `src/server/queries.ts`: stats, export, review, source list, and hide/unhide helpers.
- `app/api/records/export.csv/route.ts`: filtered CSV export route.
- `app/api/admin/review/route.ts`, `app/api/admin/hide/route.ts`: token-protected admin review/correction routes.
- `app/admin/page.tsx`, `src/components/Dashboard.tsx`, `src/components/LocationMap.tsx`, `src/components/uiLanguage.ts`: publish-readiness UI additions.
- `docs/superpowers/plans/2026-06-10-publish-readiness-features.md`: implementation plan for this feature batch.
- `package-lock.json`: non-force audit fix updated transitive resolutions and Next resolved patch version to 16.2.9.

## Next Session

- `./init.sh` passed on 2026-09-30 with `NPM_CONFIG_SCRIPT_SHELL` set to Git Bash: 29 Python unit tests, 5 Node integration tests, lint, typecheck, and coverage. `npm run build` passed. Both seed exports matched after temporary DB migration and restore.
- Review the generated-file diff and first GitHub Actions run before assuming the remote Taipei DOT listing format is unchanged. A geocoder outage should leave announcement export publishable and be reported separately in the workflow summary.

- Start by checking `git status --short`.
- Ignore `.omx/` runtime state changes unless explicitly requested.
- Run `./init.sh` before publishing or merging; run `npm run test:e2e` separately when UI behavior changes.
- After deploy, open the Render URL, switch to the map tab, and verify the map shows grouped starter locations without running `/admin` geocoding.
- Use CI/Docker Node 22 for release confidence. Local Homebrew Node 23 can run tests, but one dev dependency warns that Node 23 is outside its preferred engine range.
- The bundled seed now has 94 regular PDF sources and 2,407 records through 115.08.26; it continues to exclude the separate `三次以上且設籍本市者` subtype.

## Completion Handoff Format

- Update `feature_list.json` when feature status or evidence changes.
- Append to `progress.md`:
  - What changed
  - Verification commands and outcomes
  - Remaining risks
  - Exact next action
