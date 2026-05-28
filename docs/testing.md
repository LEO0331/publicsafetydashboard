# Testing

## Layers

1. Unit tests: Python parser, crawler extraction, violation parsing, and geocoder privacy checks.
2. Integration tests: SQLite/API query behavior through `src/server/queries.ts`.
3. End-to-end tests: Playwright tests for dashboard, map, filter, and admin auth flows.
4. Lighthouse CI: audits `/` and `/admin` against Performance, Accessibility, Best Practices, and SEO gates.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run lighthouse:ci
npm run build
./init.sh
```

## Test Data

`e2e/fixtures/seed-e2e-db.mjs` creates `drizzle/e2e.db` with deterministic announcement, record, and geocoded-location data. E2E and Lighthouse use this fixture so CI does not depend on live Taipei DOT pages or Nominatim.

## E2E Coverage

- Dashboard loads data from SQLite through API routes.
- Stats and announcement counts render.
- Violation type/count/location filters update visible records.
- Location data is grouped by place.
- Map tab renders.
- Admin import rejects invalid tokens.
- Desktop and mobile viewport checks guard against horizontal overflow.

## CI

`.github/workflows/ci.yml` runs dependency installation, lint, typecheck, unit/integration tests, Playwright e2e, and Lighthouse CI.
