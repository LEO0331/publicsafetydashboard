# Agent Harness

This project keeps lightweight operating context in repository files so future coding-agent sessions can restart without relying on chat history.

## Startup Path

1. Read `session-handoff.md` for the current objective, blockers, changed files, and recommended next step.
2. Read `feature_list.json` and work on one active feature at a time.
3. Run the narrowest useful verification before editing when behavior is already covered.
4. Update `progress.md` with evidence after meaningful changes.

## State Files

- `AGENTS.md`: repository operating contract, safety rules, definition of done, and verification expectations.
- `feature_list.json`: feature tracker with `name`, `description`, `status`, `dependencies`, done criteria, and evidence.
- `progress.md`: chronological work log with completed work, verification evidence, risks, and next action.
- `session-handoff.md`: restart summary for the next session.
- `init.sh`: baseline verification entrypoint.

## Verification Commands

Use a Node runtime that satisfies Next.js `>=20.9.0`.

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

`npm run test:e2e` starts a local Next.js server and may require localhost binding permission in sandboxed environments.

## End Of Session

Before handing off:

- Update `progress.md` with what changed, verification results, remaining risks, and next action.
- Update `session-handoff.md` with Last Updated, Current Objective, Blockers, Files, and Recommended Next Step.
- Keep `.omx/` runtime state changes out of project review unless specifically requested.

## Current Harness Status

`harness-creator` validation score: `100/100` on 2026-06-09.
