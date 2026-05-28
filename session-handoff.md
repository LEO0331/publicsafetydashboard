# Session Handoff

## Project
- Taipei public drunk/drug driving repeat-offender educational dashboard.

## Current state
- Harness is initialized.
- No application scaffold has been created yet.

## Start-here checklist
1. Run `./init.sh`.
2. Read `feature_list.json` and confirm `activeFeatureId`.
3. Continue only the active feature unless ownership boundaries are explicitly split.
4. Log verification evidence and risks in `progress.md`.

## Active feature guidance
- `F01` should produce:
  - Next.js App Router + TypeScript + Tailwind setup.
  - SQLite schema/migration for `sources`, `offender_records`, `geocoded_locations`.
  - Minimal app shell and API structure.

## Non-negotiables
- Respect source website with rate limits and clear User-Agent.
- No enrichment beyond public source PDFs.
- Do not display photos by default.
- Geocode only location text with caching.

## Completion handoff format
- Update `feature_list.json` statuses.
- Append to `progress.md`:
  - What changed
  - Verification commands and outcomes
  - Remaining risks
  - Exact next action
