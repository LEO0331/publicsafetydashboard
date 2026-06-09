# Production Incident Playbook

## Incident Goals

1. Protect public trust and privacy.
2. Keep the educational dashboard available when safe.
3. Avoid repeated scraping/geocoding that could violate source-site or Nominatim limits.
4. Preserve enough evidence to diagnose without exposing secrets or unnecessary personal data.

## Severity Levels

| Severity | Examples | Response |
| --- | --- | --- |
| SEV1 | Admin token leaked, unauthorized import/write, private data accidentally added, app serving misleading corrupted data | Disable admin actions, rotate token, hide affected records if needed, investigate logs and DB state before re-enabling |
| SEV2 | App down, database missing after deploy, migrations fail, map/geocode cache broken | Restore from seed/cache, rerun migrations, redeploy last known good image, document data-loss scope |
| SEV3 | Nominatim 429, PDF parse quality degraded, some rows `needsReview=true`, Lighthouse/e2e regression | Pause the risky operation, use local cache/manual review, fix parser/UI, rerun tests |
| SEV4 | Documentation typo, non-critical UI copy issue, known limitation noticed | Fix in normal workflow |

## First 10 Minutes Checklist

1. Identify whether the issue affects privacy, data integrity, availability, or only presentation.
2. Stop the triggering action if it can make things worse, for example crawler, geocoder, or repeated imports.
3. Check Render deploy logs, app logs, and import logs.
4. Confirm current environment variables: `ADMIN_TOKEN`, `SQLITE_PATH`, `DATABASE_URL`, `NODE_ENV`.
5. If admin access is suspect, rotate `ADMIN_TOKEN` immediately.
6. If source data may be wrong, mark affected records hidden instead of deleting until diagnosis is complete.

## Common Incidents

### Render Free Data Reset

Symptoms:

- Dashboard returns to starter data or empty data after redeploy/restart.
- Uploaded PDFs/logs disappear.

Cause:

- Render free has ephemeral filesystem storage.

Response:

1. Re-seed with `npm run seed:initial` or rely on startup script.
2. Re-import needed PDFs.
3. Re-seed geocode cache with committed `data/seed/geocoded_locations.json`.
4. For durable data, move to persistent disk or a VPS/volume host.

### Map Empty After Import

Symptoms:

- Records/table show data, but map has no circles.

Cause:

- `offender_records` exists, but `geocoded_locations` lacks valid `lat`/`lng` rows.

Response:

1. Run `/admin` Generate Map Coordinates in small batches.
2. If Nominatim returns 429, stop and use local geocode export workflow.
3. Confirm `/api/locations` returns rows with non-null `lat` and `lng`.

### Nominatim HTTP 429

Symptoms:

- Import log contains `HTTP Error 429: Too many requests`.

Response:

1. Stop geocoding; the script now stops on first 429.
2. Wait before retrying.
3. Use limit `1-5`, delay `10-30` seconds.
4. Prefer local geocoding and `npm run export:geocode` for Render free.
5. Do not bypass Nominatim limits.

### PDF Parser Regression

Symptoms:

- Unexpected `needsReview=true` spike.
- Missing names/dates/locations after importing a new announcement.

Response:

1. Keep partial rows for audit; do not silently discard.
2. Save the PDF/source URL in logs.
3. Add a parser unit test using the problematic row/table shape.
4. Improve `pdf_parser.py` table/text fallback.
5. Re-import the affected source.

### Admin Token Issue

Symptoms:

- Admin routes return 503 or 401.
- Unauthorized user may have token.

Response:

1. If missing/placeholder, set a strong `ADMIN_TOKEN`.
2. If leaked, rotate token in host environment.
3. Restart deployment.
4. Review import logs for suspicious writes.

### Docker Build Failure For `better-sqlite3`

Symptoms:

- `node-gyp` error, often `not found: make`.

Response:

1. Keep `build-essential` in Dockerfile.
2. Confirm base image is Debian/Bookworm compatible.
3. Avoid switching Node base images without testing native addon build.

## Recovery Commands

```bash
npm run db:migrate
npm run seed:initial
npm run seed:geocode
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

## Evidence To Capture

- Commit SHA or Docker image tag.
- Render deploy/log timestamp.
- Import log excerpts without secrets.
- Source PDF URL/title.
- Exact command or admin action run.
- Count of affected `sources`, `offender_records`, and `geocoded_locations` rows.

## Prevention

- Keep admin actions token-protected.
- Keep geocoding cached and rate-limited.
- Run parser/import tests after changing ingestion code.
- Keep seed JSON files committed for demo recovery.
- Use persistent storage for serious deployments.
