# 系統層級取捨

## 摘要

本系統優先考量教育用途、低成本、透明資料脈絡與簡單本機操作。它刻意接受 write concurrency、geocoding automation、admin sophistication 的限制，以換取第一版的可理解性與可維護性。

## 主要取捨

| Decision | Benefit | Cost / Risk | Mitigation |
| --- | --- | --- | --- |
| Local-first SQLite | 設定簡單、備份容易、成本低、storage 透明 | 不適合高 write concurrency 或 ephemeral hosts | Production 使用 persistent disk；若 concurrent admin usage 成長則遷移 Postgres |
| Next.js full-stack app | UI 與 APIs 在同一個 deployable app | Backend logic 與 Next runtime 耦合 | Server helpers 放在 `src/server/`，scripts 不放在 request path |
| Python ingestion scripts | PDF parsing ecosystem 強 | 兩種語言的 codebase | Python 限定在 `scripts/`；用 unit tests 與 CLI docs 約束 |
| Admin token instead of full auth | 快速、低維運負擔 | 無 multi-user roles、無 audit trail、token sharing risk | 使用 strong secret；多 admins 時改成真正 auth |
| Import-time geocoding only | 保護隱私、避免 page-load latency | Map 可能在 maintenance action 前是空的 | 快取座標；Render free 使用 local cache export/import |
| Nominatim geocoder | 符合 free/open data 方向 | Rate limits、shared cloud IP 429 | 慢速 batch、429 即停止、deployment 優先使用 local cache export |
| Public record display | 來源 attribution 透明 | UI 不小心可能像 people-search | 預設停用姓名搜尋、中性文字、grouped map、預設不顯示照片 |
| Docker deployment | Node/Python/SQLite runtime 可重現 | Image 較大且 native addon 需要 build tools | 安裝 `build-essential`；記錄 `better-sqlite3` native build 行為 |
| Deterministic e2e fixture DB | CI 穩定，不依賴 live government pages | 不證明 live site availability | 保留 crawler/parser unit tests；live imports 作為維護流程手動執行 |
| Leaflet/OSM map | 無 paid API key，適合 public-interest | clustering/geocoding 不如商業 stacks 完整 | ranked location explorer 與 cached geocode rows |

## CAP 角度

本專案選擇 availability 與 operational simplicity，而不是分散式一致性。SQLite 是 single-file database，沒有 distributed consensus 問題，但 durability 取決於 filesystem persistence。Render free 的 filesystem 是 ephemeral，因此只適合 demo。若使用 paid persistent disk 或 VM volume，這個 model 對小型教育 workload 已足夠可靠。

## 隱私 vs 功能豐富度

以下功能刻意排除：

- 不做 face recognition。
- 不做 social-media enrichment。
- 不推論住家、工作地、身分關係。
- 不做 page-load geocoding。
- 不提供預設姓名搜尋 workflow。

取捨是 investigative power 較低，但更符合教育用途，也降低 misuse risk。

## 成本 vs 可靠性

專案支援免費/低成本路徑，但可靠性會隨付費基礎設施提升：

- Render free：只適合 demo；storage 可能重置；Nominatim shared IP 可能被 rate-limit。
- Render paid disk / Fly volume / VPS：SQLite 與 cached files 可持久化。
- Managed Postgres：更適合 multi-user production，但需要 schema/query migration。
- Paid geocoding：更可靠，但有 API keys、成本與 vendor constraints。

## 簡單性 vs 可擴展性

第一版刻意讓 moving parts 可理解。若專案成長，壓力點會是：

- 長時間 PDF imports 應移到 background worker queue。
- 出現 concurrent writes 或 larger teams 時，SQLite 應移到 Postgres。
- 多 operators 時，Admin token 應改成 real authentication。
- 若 map data 變成 operationally important，geocode cache 應備份或 managed。
