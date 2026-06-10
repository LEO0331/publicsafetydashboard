# Publish Readiness Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add small publish-ready features: data freshness, review summaries, CSV export, reversible hide/correction workflow, and a map legend.

**Architecture:** Reuse existing SQLite query helpers in `src/server/queries.ts`, existing admin token enforcement in `src/server/admin.ts`, and current dashboard/admin components. Keep all changes dependency-free and privacy-preserving.

**Tech Stack:** Next.js App Router, TypeScript, SQLite via `better-sqlite3`, React/Tailwind, Playwright, Node test runner, Python unittest.

---

### Task 1: Server Query Helpers

**Files:**
- Modify: `src/server/queries.ts`
- Test: `tests/integration/api_filters.test.mjs`

- [ ] Add stats fields for `needsReview`, `latestPublishedDate`, `latestDownloadedAt`, and `latestRecordUpdatedAt`.
- [ ] Add `getReviewItems()` to list visible records with `needs_review = 1`.
- [ ] Add `getAdminSources()` to list sources with visible record counts.
- [ ] Add `setSourceHidden()` and `setRecordHidden()` using `is_hidden`, never delete.
- [ ] Add `getExportRecords()` using the same filters as `getRecords()` without pagination.
- [ ] Extend integration tests for new stats, review list, source list, reversible hide, and CSV data source.

### Task 2: API Routes

**Files:**
- Create: `app/api/records/export.csv/route.ts`
- Create: `app/api/admin/review/route.ts`
- Create: `app/api/admin/hide/route.ts`

- [ ] CSV route accepts the same public filters as `/api/records` and returns `text/csv; charset=utf-8`.
- [ ] Admin review route requires `x-admin-token` and returns review rows plus source list.
- [ ] Admin hide route requires `x-admin-token`, accepts `{ target: "source" | "record", id, hidden }`, and updates `is_hidden` only.
- [ ] Add integration tests or E2E requests for unauthorized and authorized behavior.

### Task 3: Dashboard UI

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/uiLanguage.ts`
- Test: `e2e/dashboard-business-flow.spec.ts`

- [ ] Add compact data freshness/review card using stats fields.
- [ ] Add CSV export link/button that preserves current filters.
- [ ] Keep name search disabled and export limited to current public columns.
- [ ] Add E2E assertions for freshness card, review count, and CSV export response.

### Task 4: Admin UI

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `src/components/uiLanguage.ts`
- Test: `e2e/dashboard-business-flow.spec.ts`

- [ ] Load admin review data when a token is present.
- [ ] Show rows needing review and sources with hide/unhide buttons.
- [ ] Call admin hide route and refresh logs/review data.
- [ ] Add E2E/API assertions that wrong token is rejected and correct token can hide/unhide a record/source.

### Task 5: Map Legend And Docs

**Files:**
- Modify: `src/components/LocationMap.tsx`
- Modify: `src/components/uiLanguage.ts`
- Modify: `progress.md`, `feature_list.json`, `session-handoff.md`

- [ ] Add a small bilingual legend explaining grouped circles, size by incident count, and approximate demo geocoding.
- [ ] Update project state with verification evidence.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run test:e2e`.
