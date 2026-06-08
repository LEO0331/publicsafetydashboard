# Session Handoff

## Project

- Taipei public drunk/drug driving repeat-offender educational dashboard.
- Production target: Render full-stack Next.js app at `https://publicsafetydashboard.onrender.com`.

## Current State

- Core F01-F07 implementation is complete.
- App uses Next.js App Router, TypeScript, Tailwind CSS, SQLite, Drizzle migrations, Python ingestion scripts, and Playwright/Lighthouse verification.
- Starter deploy data is bundled in `data/seed/initial_announcements.json` and seeded on Render startup only when the database is empty.
- Frontend supports Traditional Chinese by default and English via a persisted `localStorage` language toggle.
- Map view uses a ranked/searchable grouped-location explorer with scaled circles instead of showing every location as equal-density pins.

## Start-Here Checklist

1. Run `./init.sh` for the baseline harness check.
2. Run `npm run lint`, `npm run typecheck`, and `npm test` before making behavioral changes.
3. For frontend/map changes, run `npm run test:e2e` with the bundled Node runtime if local Node is below Next's required version.
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
- Local default Node may be older than Next requires; use `/Users/Leo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` for production build/E2E if needed, then run `npm rebuild better-sqlite3` afterward to restore the default runtime.

## Completion Handoff Format

- Update `feature_list.json` when feature status or evidence changes.
- Append to `progress.md`:
  - What changed
  - Verification commands and outcomes
  - Remaining risks
  - Exact next action
