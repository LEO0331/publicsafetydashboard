# Project Structure

```text
app/                    Next.js App Router pages and API routes
src/components/         Reusable React UI components
src/db/                 Drizzle schema and database client
src/server/             Server-only query/admin helpers
scripts/                Python ingestion plus Node maintenance utilities
scripts/pdf_parser.py   PDF table/text parser used by import_pdf.py
data/seed/              Bundled parsed starter dataset, no PDF binaries/photos
drizzle/migrations/     SQL migrations
e2e/                    Playwright specs
e2e/fixtures/           Deterministic e2e database seeding
tests/unit/             Python unit tests
tests/integration/      Node integration tests
docs/                   Architecture, design, testing, operations notes
.github/workflows/      CI/CD workflow
```

## Root Files

Framework and tool configuration stays at the root because the tools expect it there:

- `package.json`
- `next.config.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `eslint.config.mjs`
- `tsconfig.json`
- `playwright.config.ts`
- `lighthouserc.cjs`
- `drizzle.config.ts`

Harness files stay at the root for quick agent startup:

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `init.sh`
