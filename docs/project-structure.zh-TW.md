# 專案結構

```text
app/                    Next.js App Router pages 與 API routes
src/components/         可重用 React UI components
src/db/                 Drizzle schema 與 database client
src/server/             Server-only query/admin helpers
scripts/                Python ingestion 與 maintenance utilities
scripts/pdf_parser.py   import_pdf.py 使用的 PDF table/text parser
data/seed/              內建解析後起始資料，不包含 PDF binaries/photos
drizzle/migrations/     SQL migrations
e2e/                    Playwright specs
e2e/fixtures/           Deterministic e2e database seeding
tests/unit/             Python unit tests
tests/integration/      Node integration tests
docs/                   架構、設計、測試、維運文件
.github/workflows/      CI/CD workflows
```

## Root Files

Framework 與 tool configuration 保留在 root，因為相關工具預期它們在這裡：

- `package.json`
- `next.config.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `eslint.config.mjs`
- `tsconfig.json`
- `playwright.config.ts`
- `lighthouserc.cjs`
- `drizzle.config.ts`

Harness files 保留在 root，方便 agents 快速啟動：

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `init.sh`
