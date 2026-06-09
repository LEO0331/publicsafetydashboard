# Taipei Public Safety Dashboard - Agent Harness

This repository builds an educational dashboard from Taipei City Government public repeat-offender PDF announcements.

## Mission
- Build a local-first full-stack app to import, parse, store, and display Taipei DOT "酒駕累犯公布專區" PDF data.
- Use neutral public-safety wording and source attribution.
- Keep first version simple and verifiable.

## Scope
- In scope:
  - Next.js App Router + TypeScript + Tailwind frontend.
  - Next.js API routes for data/stat/import endpoints.
  - Python ingestion scripts for crawl/parse/geocode/rebuild.
  - SQLite schema and migrations.
  - Map visualization with OSM/Leaflet using cached geocoding.
- Out of scope:
  - Face recognition, social-media enrichment, identity inference, paid map APIs.
  - Aggressive crawling or bypassing access controls.

## Working Rules
- Startup Workflow:
  1. Read `session-handoff.md` for the current objective, blockers, files, and recommended next step.
  2. Read `feature_list.json` and select one unfinished or explicitly requested feature.
  3. Run `./init.sh` or the narrow verification command before claiming completion.
  4. Keep work restartable by updating `progress.md` after meaningful changes.
- One feature at a time: keep `feature_list.json.activeFeatureId` aligned with the current feature, or `null` when no feature is active.
- Follow implementation priority in `feature_list.json`.
- Keep one active feature at a time unless explicit multi-agent ownership exists.
- No new dependency unless needed for stated requirements.
- Keep diffs small and reversible.
- Record evidence in `progress.md` before marking work complete.

## Data Safety And Compliance
- Do not enrich people data from other sources.
- Do not show photos by default; only track `hasPhoto`.
- Geocoder input may contain only location text (with Taipei context), never names/facts.
- Include this disclaimer in UI:
  - `本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。`

## Definition Of Done
- Feature implementation completed.
- Relevant tests/checks pass.
- Risks and gaps documented in `progress.md`.
- `feature_list.json` status and next action updated.
- End of Session:
  - Update `session-handoff.md` with Last Updated, Current Objective, Blockers, Files changed, and Recommended Next Step.
  - Leave the repository in a clean restartable state, with verification evidence recorded or the exact failed command noted.

## Verification
- Run `./init.sh` before final completion claims.
- If a command is unavailable (tooling not scaffolded yet), capture that as a gap in `progress.md` and continue with next valid checks.
