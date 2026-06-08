# Testing

## Layers

1. Unit tests: Python PDF parser, crawler extraction, violation parsing, geocoder privacy, and geocode-cache behavior.
2. Integration tests: SQLite/API query behavior and admin token enforcement through server helpers.
3. End-to-end tests: Playwright tests for dashboard, map, filter, and admin auth flows.
4. Lighthouse CI: audits `/` and `/admin` against Performance, Accessibility, Best Practices, and SEO gates.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run lighthouse:ci
npm run build
./init.sh
```

## Coverage Gates

`npm run test:coverage` enforces project-focused coverage without adding a third-party test runner:

- Python ingestion modules tracked: `scripts/common.py`, `scripts/crawl_sources.py`, `scripts/geocode_locations.py`, and `scripts/pdf_parser.py`.
- Python line coverage threshold: 80%.
- Node server integration coverage threshold: 80%.

Current local baseline:

```text
Python tracked modules: 80.72% line coverage
Node integration/server code: 97.76% line coverage
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

`.github/workflows/ci.yml` runs dependency installation, lint, typecheck, unit/integration tests, coverage gates, Playwright e2e, and Lighthouse CI.
