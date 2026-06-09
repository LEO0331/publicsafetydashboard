# Agent Harness

本專案把 coding agent 需要的操作脈絡保存在 repo 檔案中，避免下一次 session 只能依賴聊天紀錄接續。

## 啟動流程

1. 先讀 `session-handoff.md`，確認目前目標、blockers、異動檔案與建議下一步。
2. 再讀 `feature_list.json`，一次只處理一個 active feature。
3. 若行為已有測試保護，修改前先跑最小且相關的驗證。
4. 有實質變更後，把 evidence 更新到 `progress.md`。

## 狀態檔案

- `AGENTS.md`：repo 操作契約、安全規則、Definition of Done 與驗證要求。
- `feature_list.json`：feature tracker，包含 `name`、`description`、`status`、`dependencies`、完成條件與 evidence。
- `progress.md`：依時間排序的工作紀錄，包含完成內容、驗證證據、風險與下一步。
- `session-handoff.md`：下一個 session 的 restart 摘要。
- `init.sh`：基準驗證入口。

## 驗證指令

請使用符合 Next.js `>=20.9.0` 要求的 Node runtime。

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

`npm run test:e2e` 會啟動本機 Next.js server；在 sandbox 環境中可能需要 localhost binding 權限。

## Session 結束前

- 更新 `progress.md`：記錄變更、驗證結果、剩餘風險與下一步。
- 更新 `session-handoff.md`：記錄 Last Updated、Current Objective、Blockers、Files 與 Recommended Next Step。
- 除非使用者要求，否則不要把 `.omx/` runtime state changes 納入專案 review。

## 目前 Harness 狀態

2026-06-09 使用 `harness-creator` 驗證分數：`100/100`。
