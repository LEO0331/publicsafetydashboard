# Session Handoff

Last Updated: 2026-06-10
Current Objective: keep the dashboard publish-ready and ensure the public demo map shows grouped starter locations after Render deployment.
Recommended Next Step: redeploy Render after committing the current changes so startup imports the committed `data/seed/geocoded_locations.json` cache.

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
- The bundled 50-record starter dataset has 32 approximate `local-demo-seed` cached map coordinates so Render can show the demo map without calling Nominatim.

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

## Files

- `src/components/Dashboard.tsx`: dashboard records pagination controls and page metadata.
- `src/components/uiLanguage.ts`: Traditional Chinese and English pagination copy.
- `tests/integration/api_filters.test.mjs`: direct API pagination offset regression.
- `e2e/dashboard-business-flow.spec.ts`: Traditional Chinese pagination UI regression.
- `e2e/interactive-qa.spec.ts`: English pagination UI regression.
- `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`: harness restart and evidence updates.
- `data/seed/geocoded_locations.json`: committed demo geocode cache for bundled starter locations.
- `README.md`, `README.zh-TW.md`, `docs/deployment*.md`, `docs/operations*.md`: demo map and Render geocode-cache documentation.
- `tests/unit/test_ingestion.py`: geocode seed coverage and migrated SQLite insert regression.

## Next Session

- Start by checking `git status --short`.
- Ignore `.omx/` runtime state changes unless explicitly requested.
- Run `./init.sh` before publishing or merging; run `npm run test:e2e` separately when UI behavior changes.
- After deploy, open the Render URL, switch to the map tab, and verify the map shows grouped starter locations without running `/admin` geocoding.

## Completion Handoff Format

- Update `feature_list.json` when feature status or evidence changes.
- Append to `progress.md`:
  - What changed
  - Verification commands and outcomes
  - Remaining risks
  - Exact next action
