# System-Level Tradeoffs

## Summary

The system is optimized for educational use, low cost, transparent data lineage, and simple local operation. It intentionally accepts limits in write concurrency, geocoding automation, and admin sophistication to keep the first version understandable and maintainable.

## Key Tradeoffs

| Decision | Benefit | Cost / Risk | Mitigation |
| --- | --- | --- | --- |
| Local-first SQLite | Simple setup, easy backup, low cost, transparent storage | Not ideal for high write concurrency or ephemeral hosts | Use persistent disk for production; migrate to Postgres if concurrent admin usage grows |
| Next.js full-stack app | One deployable app for UI and APIs | Backend logic is coupled to Next runtime | Keep server helpers in `src/server/` and scripts outside request path |
| Python ingestion scripts | Strong PDF parsing ecosystem | Two-language codebase | Keep Python isolated to `scripts/`; cover with unit tests and CLI docs |
| Admin token instead of full auth | Fast and low operational overhead | No multi-user roles, no audit trail, token sharing risk | Use strong secret; move to real auth if multiple admins need access |
| Import-time geocoding only | Protects privacy and avoids page-load latency | Map can be empty until maintenance action runs | Cache coordinates; export/import geocode seed for Render free |
| Nominatim geocoder | Free/open data alignment | Rate limits, shared cloud IP 429s | Batch slowly, stop on 429, prefer local cache export for deployment |
| Public record display | Transparent source attribution | Risk of looking like people-search if UI is careless | Disable default name search; neutral wording; grouped map; no photos by default |
| Docker deployment | Reproducible Node/Python/SQLite runtime | Larger image and native addon build requirements | Install `build-essential`; document `better-sqlite3` native build behavior |
| Deterministic e2e fixture DB | Stable CI independent of live government pages | Does not prove live site availability | Keep crawler/parser unit tests; run live imports manually as maintenance |
| Leaflet/OSM map | No paid API key, public-interest friendly | Less polished clustering/geocoding than commercial stacks | Ranked location explorer and cached geocode rows |

## CAP-Style View

This project chooses availability and operational simplicity over distributed consistency. SQLite is a single-file database, so there is no distributed consensus problem, but the tradeoff is that durability depends on filesystem persistence. On Render free, the filesystem is ephemeral, so the app is suitable for demo only. On a paid persistent disk or VM volume, the model becomes reliable enough for small educational workloads.

## Privacy vs. Feature Richness

Several potentially useful features are intentionally excluded:

- No face recognition.
- No social-media enrichment.
- No home/workplace inference.
- No page-load geocoding.
- No default name-search workflow.

The tradeoff is less investigative power, but the result better matches the educational purpose and reduces misuse risk.

## Cost vs. Reliability

The project supports a free/low-cost path, but reliability improves with paid infrastructure:

- Render free: demo only; storage can reset; Nominatim shared IP may be rate-limited.
- Render paid disk / Fly volume / VPS: durable SQLite and cached files.
- Managed Postgres: better for multi-user production, but requires a schema/query migration.
- Paid geocoding: more reliable but introduces API keys, cost, and vendor constraints.

## Simplicity vs. Scalability

The first version favors a small number of understandable moving parts. If the project grows, likely pressure points are:

- Long-running PDF imports should move to a background worker queue.
- SQLite should move to Postgres if concurrent writes or larger teams appear.
- Admin token should become real authentication if multiple operators need access.
- Geocode cache should be backed up or managed if map data becomes operationally important.
