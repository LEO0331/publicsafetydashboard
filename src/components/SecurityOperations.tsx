"use client";

import { useRef, useState } from "react";
import type { AdminRequest } from "./adminSession";
import type { Language } from "./uiLanguage";
import type { SecurityReport } from "../server/observability";

const copy = {
  en: {
    title: "Security & Operations", intro: "Aggregate API activity, not visitor profiles. No raw IPs, search filters, names or tokens are collected by this module.",
    refresh: "Load security report", busy: "Loading…", disabled: "Observation disabled. Enable ENABLE_API_OBSERVABILITY in the service environment.",
    unauthorized: "Admin authorization required.", failure: "Unable to load the report.", coverage: "Per-process rolling 24-hour window. Counts cover instrumented handler responses, not network delivery, static pages or all framework errors. Missing windows do not prove zero traffic.",
    requests: "API responses", exports: "CSV responses", rows: "CSV rows returned", denied: "Denied admin requests", dropped: "Dropped observations", p95: "Approx. p95 upper bound", route: "Route", errors: "4xx / 5xx", methods: "HTTP methods", clients: "Client signals (unverified)", probes: "API probe categories", auth: "Admin outcomes", window: "Recorded windows", recent: "Recent recorded windows (UTC)", time: "Window start", noData: "No observed responses yet.", since: "Process observation started", skipped: "Pending skipped log windows",
    details: "Details, audit & data recovery", indicators: "Investigation indicators", exportBurst: "Windows with ≥10 CSV responses", authFailures: "Windows with ≥5 denied admin requests", serverErrors: "Server errors", limited: "Some observations or logs were dropped.", noSignals: "No configured indicators triggered in recorded windows.", caveat: "Fixed thresholds, not confirmed incidents.", restored: "Restored windows", audit: "Recent admin operations", action: "Operation", outcome: "HTTP status", auditEmpty: "No recorded admin operations.", auditNote: "At most 100 recent events; no record IDs or individual administrator identity. Not a durable audit ledger.", auditDropped: "Audit events/logs skipped", csv: "Export security CSV", backup: "Download JSONL backup", restore: "Restore backup", fileLabel: "Previous JSONL aggregate file", recovery: "Ended time buckets only in backups (coverage may be partial). Restore only your own single-process exports from before this process started, within 24 hours. History remains volatile.", restoredResult: "Restored / skipped", invalidFile: "Select a nonempty JSONL file up to 4 MiB.", downloadFailed: "Download or restore failed.", emptyBackup: "No completed windows to back up.",
    labels: { records: "Records", export: "CSV export", stats: "Statistics", locations: "Locations", admin_review: "Review", admin_hide: "Visibility change", import_logs: "Import logs", import_crawl: "Crawl", import_url: "PDF URL", import_file: "PDF upload", import_geocode: "Geocode", security_report: "Security report (denied only)", unknown_api: "Unknown API" },
  },
  zh: {
    title: "資安與營運", intro: "僅彙總 API 活動，不建立訪客側寫；此模組不收集原始 IP、搜尋條件、姓名或權杖。",
    refresh: "載入資安報告", busy: "載入中…", disabled: "觀測已停用。可在服務環境設定 ENABLE_API_OBSERVABILITY 啟用。",
    unauthorized: "需要管理者驗證。", failure: "無法載入報告。", coverage: "單一程序最近 24 小時的彙總視窗。僅涵蓋已加入觀測的 API 處理回應，不代表網路送達、靜態頁面或所有框架錯誤；缺失視窗不等於零流量。",
    requests: "API 回應數", exports: "CSV 回應數", rows: "CSV 回傳列數", denied: "管理驗證拒絕", dropped: "丟棄觀測", p95: "約略 p95 上界", route: "路由", errors: "4xx／5xx", methods: "HTTP 方法", clients: "用戶端訊號（未驗證）", probes: "API 探測類別", auth: "管理驗證結果", window: "記錄視窗數", recent: "近期觀測視窗（UTC）", time: "視窗起始時間", noData: "尚無已觀測回應。", since: "程序觀測開始", skipped: "待回報略過的日誌視窗",
    details: "詳細資訊、操作紀錄與資料還原", indicators: "調查訊號", exportBurst: "CSV 回應達 10 次的視窗", authFailures: "管理驗證拒絕達 5 次的視窗", serverErrors: "伺服器錯誤", limited: "部分觀測或日誌未能記錄。", noSignals: "已記錄視窗未觸發設定的訊號。", caveat: "固定門檻，並非確認的資安事件。", restored: "還原視窗", audit: "近期管理操作", action: "操作", outcome: "HTTP 狀態", auditEmpty: "尚無已記錄的管理操作。", auditNote: "最多 100 筆近期事件；不含個案 ID 或個別管理者身分，並非永久稽核帳本。", auditDropped: "略過的操作／日誌", csv: "匯出資安 CSV", backup: "下載 JSONL 備份", restore: "還原備份", fileLabel: "先前的 JSONL 彙總檔", recovery: "備份僅包含已結束的時間視窗（觀測可能不完整）。只還原本程序啟動前、24 小時內的自有單一程序匯出；歷史仍為揮發性。", restoredResult: "已還原／略過", invalidFile: "請選擇不超過 4 MiB 的非空 JSONL 檔。", downloadFailed: "下載或還原失敗。", emptyBackup: "尚無已完成視窗可備份。",
    labels: { records: "資料列表", export: "CSV 匯出", stats: "統計", locations: "地點", admin_review: "複核", admin_hide: "可見性異動", import_logs: "匯入日誌", import_crawl: "爬取", import_url: "PDF 網址", import_file: "PDF 上傳", import_geocode: "地理編碼", security_report: "資安報告（僅拒絕）", unknown_api: "未知 API" },
  },
} as const;

function Distribution({ title, counts }: { title: string; counts: Record<string, number> }) {
  return <div className="min-w-0"><h3 className="font-medium">{title}</h3><dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
    {Object.entries(counts).filter(([, value]) => value > 0).map(([key, value]) => <div key={key} className="contents"><dt className="break-words text-[var(--muted)]">{key}</dt><dd className="tabular-nums">{value.toLocaleString()}</dd></div>)}
  </dl></div>;
}

export default function SecurityOperations({ request, signal, language }: { request: AdminRequest; signal: AbortSignal; language: Language }) {
  const t = copy[language];
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [working, setWorking] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "disabled" | "unauthorized" | "failure">("idle");
  async function load() {
    setReport(null);
    setStatus("busy");
    try {
      const response = await request("/api/admin/security", { signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 503) { setStatus("unauthorized"); return; }
      if (!response.ok) throw Error("report");
      const data = await response.json();
      if (signal.aborted) return;
      if (!data.enabled) { setStatus("disabled"); return; }
      setReport(data as SecurityReport);
      setStatus("idle");
    } catch { if (!signal.aborted) setStatus("failure"); }
  }
  async function download(format: "csv" | "jsonl") {
    if (working) return;
    setWorking(true); setRecoveryMessage("");
    try {
      const response = await request("/api/admin/security?format=" + format, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error("download");
      const blob = await response.blob();
      if (signal.aborted) return;
      if (!blob.size) { setRecoveryMessage(t.emptyBackup); return; }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "public-safety-security." + format;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (!signal.aborted) setRecoveryMessage(t.downloadFailed); }
    finally { if (!signal.aborted) setWorking(false); }
  }
  async function restore() {
    if (working) return;
    const file = fileInput.current?.files?.[0];
    if (!file || !file.size || file.size > 4 * 1024 * 1024) { setRecoveryMessage(t.invalidFile); return; }
    setWorking(true); setRecoveryMessage("");
    try {
      const response = await request("/api/admin/security", {
        method: "POST", headers: { "x-security-restore": "1", "content-type": "text/plain" },
        body: file, cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("restore");
      const result = await response.json();
      if (signal.aborted) return;
      setRecoveryMessage(t.restoredResult + ": " + result.accepted + " / " + result.skipped);
      if (fileInput.current) fileInput.current.value = "";
      // Refresh data without clearing the panel or closing the disclosure.
      const next = await request("/api/admin/security", { signal: AbortSignal.timeout(10000) });
      if (!next.ok) throw Error("refresh");
      const data = await next.json();
      if (signal.aborted) return;
      if (!data.enabled) { setReport(null); setStatus("disabled"); return; }
      setReport(data as SecurityReport);
    } catch { if (!signal.aborted) setRecoveryMessage(t.downloadFailed); }
    finally { if (!signal.aborted) setWorking(false); }
  }
  const p95 = (value: number | null, count: number) => value === null ? count ? ">120,000 ms" : "—" : `≤ ${value.toLocaleString()} ms`;
  return <section className="ledger-panel mt-5 min-w-0 p-4" data-testid="security-operations">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-medium">{t.title}</h2>
      <button type="button" disabled={status === "busy" || working} onClick={load} className="focus-ring border border-[var(--ink)] px-3 py-2 text-sm disabled:opacity-50" data-testid="security-load">{status === "busy" ? t.busy : t.refresh}</button>
    </div>
    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.intro}</p>
    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.coverage}</p>
    {status !== "idle" && <p className="mt-3 text-sm" role="status">{t[status]}</p>}
    {report && <div className="mt-4 min-w-0 space-y-4" data-testid="security-report">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[[t.requests, report.requests.toLocaleString()], [t.exports, report.exportResponses.toLocaleString()], [t.rows, report.exportRows.toLocaleString()], [t.denied, report.auth.denied.toLocaleString()], [t.dropped, report.dropped.toLocaleString()], [t.p95, p95(report.p95UpperMs, report.requests)]].map(([label, value]) => <div key={label} className="min-w-0 border border-[var(--line)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-lg font-medium tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-[var(--muted)]">{t.since}: {report.startedAt} · {t.window}: {report.windowCount} · {t.skipped}: {report.skippedLogs}</p>
      {!report.requests && <p className="text-sm">{t.noData}</p>}
      <div className="border border-[var(--line)] p-3 text-sm" data-testid="security-indicators">
        <h3 className="font-medium">{t.indicators}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.caveat}</p>
        {!report.indicators.exportBurst && !report.indicators.authFailures && !report.indicators.serverErrors && !report.indicators.limitedCoverage
          ? <p className="mt-2">{report.requests ? t.noSignals : t.noData}</p>
          : <ul className="mt-2 space-y-1">{report.indicators.exportBurst > 0 && <li>{t.exportBurst}: {report.indicators.exportBurst}</li>}{report.indicators.authFailures > 0 && <li>{t.authFailures}: {report.indicators.authFailures}</li>}{report.indicators.serverErrors > 0 && <li>{t.serverErrors}: {report.indicators.serverErrors}</li>}{report.indicators.limitedCoverage && <li>{t.limited}</li>}</ul>}
      </div>
      <details className="min-w-0 border-t border-[var(--line)] pt-3" data-testid="security-details">
        <summary className="focus-ring cursor-pointer text-sm font-medium">{t.details}</summary>
        <div className="mt-4 min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={working} onClick={() => download("csv")} className="focus-ring border border-[var(--ink)] px-3 py-2 text-sm disabled:opacity-50" data-testid="security-export">{t.csv}</button>
          <button type="button" disabled={working} onClick={() => download("jsonl")} className="focus-ring border border-[var(--ink)] px-3 py-2 text-sm disabled:opacity-50" data-testid="security-backup">{t.backup}</button>
        </div>
        <p className="text-xs leading-5 text-[var(--muted)]">{t.recovery} {t.restored}: {report.restoredWindows}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 max-w-full text-xs">{t.fileLabel}<input ref={fileInput} type="file" accept=".jsonl,.ndjson,.txt,text/plain,application/x-ndjson" className="focus-ring mt-1 block w-full max-w-full border border-[var(--line)] p-2" data-testid="security-restore-file"/></label>
          <button type="button" disabled={working} onClick={restore} className="focus-ring border border-[var(--ink)] px-3 py-2 text-sm disabled:opacity-50" data-testid="security-restore">{t.restore}</button>
        </div>
        {recoveryMessage && <p role="status" className="text-sm" data-testid="security-recovery-message">{recoveryMessage}</p>}
        <div className="min-w-0" data-testid="security-audit"><h3 className="font-medium">{t.audit}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.auditNote} {t.auditDropped}: {report.auditDropped}</p>
          {report.audit.length ? <div className="mt-2 max-h-56 overflow-auto" tabIndex={0} role="region" aria-label={t.audit}><table className="w-full min-w-[380px] text-left text-xs"><thead><tr><th scope="col" className="p-2">UTC</th><th scope="col" className="p-2">{t.action}</th><th scope="col" className="p-2">{t.outcome}</th></tr></thead><tbody>{report.audit.slice(0, 20).map((event, index) => <tr key={index} className="border-t border-[var(--line)]"><td className="p-2">{event.at}</td><td className="p-2">{event.action}</td><td className="p-2">{event.status}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm">{t.auditEmpty}</p>}
        </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t.route}><table className="w-full min-w-[420px] text-left text-sm">
        <thead><tr className="border-b border-[var(--line)]"><th scope="col" className="p-2">{t.route}</th><th scope="col" className="p-2">{t.requests}</th><th scope="col" className="p-2">{t.errors}</th><th scope="col" className="p-2">{t.p95}</th></tr></thead>
        <tbody>{report.routes.map(row => <tr key={row.route} className="border-b border-[var(--line)]"><th scope="row" className="p-2 font-normal">{t.labels[row.route]}</th><td className="p-2 tabular-nums">{row.requests}</td><td className="p-2 tabular-nums">{Object.entries(row.status).filter(([key]) => /^(?:4|5|other_4|other_5)/.test(key)).reduce((sum, [, count]) => sum + count, 0)}</td><td className="p-2">{p95(row.p95UpperMs, row.requests)}</td></tr>)}</tbody>
      </table></div>
      {!!report.windows.length && <div className="min-w-0"><h3 className="mb-2 font-medium">{t.recent}</h3><div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t.recent}><table className="w-full min-w-[480px] text-left text-xs"><thead><tr className="border-b border-[var(--line)]"><th scope="col" className="p-2">{t.time}</th><th scope="col" className="p-2">{t.requests}</th><th scope="col" className="p-2">{t.exports}</th><th scope="col" className="p-2">{t.denied}</th><th scope="col" className="p-2">{t.dropped}</th></tr></thead><tbody>{report.windows.slice(-12).reverse().map(window => <tr key={window.start} className="border-b border-[var(--line)]"><th scope="row" className="p-2 font-normal">{window.start}</th>{[window.requests, window.exports, window.denied, window.dropped].map((count, index) => <td key={index} className="p-2 tabular-nums">{count}</td>)}</tr>)}</tbody></table></div></div>}
      <div className="grid gap-4 sm:grid-cols-2"><Distribution title={t.methods} counts={report.methods}/><Distribution title={t.clients} counts={report.clients}/><Distribution title={t.probes} counts={report.probes}/><Distribution title={t.auth} counts={report.auth}/></div>
        </div>
      </details>
    </div>}
  </section>;
}
