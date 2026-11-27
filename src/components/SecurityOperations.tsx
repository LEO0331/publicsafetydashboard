"use client";

import { useState } from "react";
import type { Language } from "./uiLanguage";
import type { SecurityReport } from "../server/observability";

const copy = {
  en: {
    title: "Security & Operations", intro: "Aggregate API activity, not visitor profiles. No raw IPs, search filters, names or tokens are collected by this module.",
    refresh: "Load security report", busy: "Loading…", disabled: "Observation disabled. Enable ENABLE_API_OBSERVABILITY in the service environment.",
    unauthorized: "Admin authorization required.", failure: "Unable to load the report.", coverage: "Per-process rolling 24-hour window. Counts cover instrumented handler responses, not network delivery, static pages or all framework errors. Missing windows do not prove zero traffic.",
    requests: "API responses", exports: "CSV responses", rows: "CSV rows returned", denied: "Denied admin requests", dropped: "Dropped observations", p95: "Approx. p95 upper bound", route: "Route", errors: "4xx / 5xx", methods: "HTTP methods", clients: "Client signals (unverified)", probes: "API probe categories", auth: "Admin outcomes", window: "Recorded windows", noData: "No observed responses yet.", since: "Process observation started", skipped: "Pending skipped log windows",
    labels: { records: "Records", export: "CSV export", stats: "Statistics", locations: "Locations", admin_review: "Review", admin_hide: "Visibility change", import_logs: "Import logs", import_crawl: "Crawl", import_url: "PDF URL", import_file: "PDF upload", import_geocode: "Geocode", security_report: "Security report (denied only)", unknown_api: "Unknown API" },
  },
  zh: {
    title: "資安與營運", intro: "僅彙總 API 活動，不建立訪客側寫；此模組不收集原始 IP、搜尋條件、姓名或權杖。",
    refresh: "載入資安報告", busy: "載入中…", disabled: "觀測已停用。可在服務環境設定 ENABLE_API_OBSERVABILITY 啟用。",
    unauthorized: "需要管理者驗證。", failure: "無法載入報告。", coverage: "單一程序最近 24 小時的彙總視窗。僅涵蓋已加入觀測的 API 處理回應，不代表網路送達、靜態頁面或所有框架錯誤；缺失視窗不等於零流量。",
    requests: "API 回應數", exports: "CSV 回應數", rows: "CSV 回傳列數", denied: "管理驗證拒絕", dropped: "丟棄觀測", p95: "約略 p95 上界", route: "路由", errors: "4xx／5xx", methods: "HTTP 方法", clients: "用戶端訊號（未驗證）", probes: "API 探測類別", auth: "管理驗證結果", window: "記錄視窗數", noData: "尚無已觀測回應。", since: "程序觀測開始", skipped: "待回報略過的日誌視窗",
    labels: { records: "資料列表", export: "CSV 匯出", stats: "統計", locations: "地點", admin_review: "複核", admin_hide: "可見性異動", import_logs: "匯入日誌", import_crawl: "爬取", import_url: "PDF 網址", import_file: "PDF 上傳", import_geocode: "地理編碼", security_report: "資安報告（僅拒絕）", unknown_api: "未知 API" },
  },
} as const;

function Distribution({ title, counts }: { title: string; counts: Record<string, number> }) {
  return <div className="min-w-0"><h3 className="font-medium">{title}</h3><dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
    {Object.entries(counts).filter(([, value]) => value > 0).map(([key, value]) => <div key={key} className="contents"><dt className="break-words text-[var(--muted)]">{key}</dt><dd className="tabular-nums">{value.toLocaleString()}</dd></div>)}
  </dl></div>;
}

export default function SecurityOperations({ token, language }: { token: string; language: Language }) {
  // The parent keys this component by token, so changing credentials clears old metrics.
  const t = copy[language];
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "disabled" | "unauthorized" | "failure">("idle");
  async function load() {
    setReport(null);
    setStatus("busy");
    try {
      const response = await fetch("/api/admin/security", { headers: { "x-admin-token": token }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 503) { setStatus("unauthorized"); return; }
      if (!response.ok) throw Error("report");
      const data = await response.json();
      if (!data.enabled) { setStatus("disabled"); return; }
      setReport(data as SecurityReport);
      setStatus("idle");
    } catch { setStatus("failure"); }
  }
  const p95 = (value: number | null, count: number) => value === null ? count ? ">120,000 ms" : "—" : `≤ ${value.toLocaleString()} ms`;
  return <section className="ledger-panel mt-5 min-w-0 p-4" data-testid="security-operations">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-medium">{t.title}</h2>
      <button type="button" disabled={!token || status === "busy"} onClick={load} className="focus-ring border border-[var(--ink)] px-3 py-2 text-sm disabled:opacity-50" data-testid="security-load">{status === "busy" ? t.busy : t.refresh}</button>
    </div>
    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.intro}</p>
    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.coverage}</p>
    {status !== "idle" && <p className="mt-3 text-sm" role="status">{t[status]}</p>}
    {report && <div className="mt-4 space-y-4" data-testid="security-report">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[[t.requests, report.requests.toLocaleString()], [t.exports, report.exportResponses.toLocaleString()], [t.rows, report.exportRows.toLocaleString()], [t.denied, report.auth.denied.toLocaleString()], [t.dropped, report.dropped.toLocaleString()], [t.p95, p95(report.p95UpperMs, report.requests)]].map(([label, value]) => <div key={label} className="min-w-0 border border-[var(--line)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-lg font-medium tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-[var(--muted)]">{t.since}: {report.startedAt} · {t.window}: {report.windowCount} · {t.skipped}: {report.skippedLogs}</p>
      {!report.requests && <p className="text-sm">{t.noData}</p>}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t.route}><table className="w-full min-w-[420px] text-left text-sm">
        <thead><tr className="border-b border-[var(--line)]"><th scope="col" className="p-2">{t.route}</th><th scope="col" className="p-2">{t.requests}</th><th scope="col" className="p-2">{t.errors}</th><th scope="col" className="p-2">{t.p95}</th></tr></thead>
        <tbody>{report.routes.map(row => <tr key={row.route} className="border-b border-[var(--line)]"><th scope="row" className="p-2 font-normal">{t.labels[row.route]}</th><td className="p-2 tabular-nums">{row.requests}</td><td className="p-2 tabular-nums">{Object.entries(row.status).filter(([key]) => /^(?:4|5|other_4|other_5)/.test(key)).reduce((sum, [, count]) => sum + count, 0)}</td><td className="p-2">{p95(row.p95UpperMs, row.requests)}</td></tr>)}</tbody>
      </table></div>
      <div className="grid gap-4 sm:grid-cols-2"><Distribution title={t.methods} counts={report.methods}/><Distribution title={t.clients} counts={report.clients}/><Distribution title={t.probes} counts={report.probes}/><Distribution title={t.auth} counts={report.auth}/></div>
    </div>}
  </section>;
}
