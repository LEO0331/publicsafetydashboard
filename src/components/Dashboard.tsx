"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Database, FileText, Filter, MapPinned, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => <div className="ledger-panel flex h-[520px] items-center justify-center text-sm text-[var(--muted)]">地圖載入中...</div>,
});

type Stats = {
  totalRecords: number;
  announcements: number;
  byCount: { value: number | null; count: number }[];
  byType: { type: string; count: number }[];
  topLocations: { location: string; count: number }[];
};

type RecordRow = {
  id: number;
  name: string | null;
  violation_date: number | null;
  violation_count: number | null;
  violation_types_json: string | null;
  location_text: string | null;
  alcohol_mg_per_l: number | null;
  source_title: string;
  pdf_url: string;
};

type LocationItem = {
  location: string;
  count: number;
  lat: number | null;
  lng: number | null;
  dateMin: number | null;
  dateMax: number | null;
  types: { type: string; count: number }[];
};

function formatDate(value: number | null) {
  return value ? new Intl.DateTimeFormat("zh-TW").format(new Date(value)) : "未載明";
}

function parseTypes(value: string | null) {
  try {
    return (JSON.parse(value || "[]") as string[]).join("、") || "未判讀";
  } catch {
    return "未判讀";
  }
}

function statLine(items: { value?: number | null; type?: string; count: number }[] | undefined) {
  if (!items?.length) return "尚無資料";
  return items.map((item) => `${item.type ?? `${item.value ?? "未判讀"}次`} ${item.count} 筆`).join("、");
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"table" | "map">("table");
  const [filters, setFilters] = useState({ violationCount: "", type: "", location: "", dateFrom: "", dateTo: "" });
  const [isLoading, setIsLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set("pageSize", "50");
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const [statsRes, recordsRes, locationsRes] = await Promise.all([fetch("/api/stats"), fetch(`/api/records?${query}`), fetch("/api/locations")]);
      if (cancelled) return;
      setStats(await statsRes.json());
      setRecords((await recordsRes.json()).rows);
      setLocations(await locationsRes.json());
      setIsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({
      violationCount: String(form.get("violationCount") ?? ""),
      type: String(form.get("type") ?? ""),
      location: String(form.get("location") ?? ""),
      dateFrom: String(form.get("dateFrom") ?? ""),
      dateTo: String(form.get("dateTo") ?? ""),
    });
  }

  return (
    <main className="min-h-screen text-[var(--ink)]" data-testid="dashboard-page">
      <a href="#dashboard-content" className="focus-ring sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2">
        跳至主要內容
      </a>
      <header className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--paper-strong)]">
        <div className="absolute inset-y-0 left-0 hidden w-4 notice-rail md:block" />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 md:grid-cols-[1fr_auto] md:px-8 md:py-10">
          <div className="animate-ledger-in">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--civic-green)]">
              <span className="border border-[var(--civic-green)] px-2 py-1">交通安全教育資料</span>
              <span className="stamp px-2 py-1">公開公告</span>
            </div>
            <h1 className="font-display max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">臺北市酒駕／毒駕／拒測累犯教育儀表板</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
              彙整臺北市政府公開 PDF 公告，協助學生以資料方式理解交通風險、重複違規樣態與地點分布。
            </p>
          </div>
          <div className="ledger-panel animate-ledger-in flex min-w-64 flex-col justify-between p-4 [animation-delay:120ms]">
            <div className="text-xs font-semibold text-[var(--muted)]">資料維護</div>
            <div className="mt-4 text-sm leading-6">匯入作業需使用管理權杖，避免非預期爬取或重複解析。</div>
            <Link href="/admin" className="focus-ring mt-5 inline-flex items-center justify-center gap-2 bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--civic-green)]">
              <RefreshCw size={16} />
              前往匯入管理
            </Link>
          </div>
        </div>
      </header>

      <section id="dashboard-content" className="mx-auto grid max-w-7xl gap-3 px-4 py-5 md:grid-cols-4 md:px-8">
        <article className="ledger-panel animate-ledger-in p-4">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>公告紀錄總筆數</span>
            <Database size={18} />
          </div>
          <div className="mt-3 text-4xl font-semibold" data-testid="total-records">
            {stats?.totalRecords ?? 0}
          </div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:60ms]">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>已匯入公告</span>
            <FileText size={18} />
          </div>
          <div className="mt-3 text-4xl font-semibold" data-testid="announcement-count">
            {stats?.announcements ?? 0}
          </div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:120ms]">
          <div className="text-sm text-[var(--muted)]">依違規次數</div>
          <div className="mt-3 text-sm leading-6">{statLine(stats?.byCount)}</div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:180ms]">
          <div className="text-sm text-[var(--muted)]">依違規類型</div>
          <div className="mt-3 text-sm leading-6">{statLine(stats?.byType)}</div>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-5 md:px-8">
        <div className="ledger-panel grid gap-3 p-4 md:grid-cols-[220px_1fr]">
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">高頻違規地點</div>
            <div className="mt-1 text-xs text-[var(--muted)]">依目前匯入資料統計</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats?.topLocations.length ? (
              stats.topLocations.map((item) => (
                <span key={item.location} className="border border-[var(--line)] bg-[#fbf7ee] px-3 py-1 text-sm">
                  {item.location}：{item.count} 筆
                </span>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)]">尚無地點統計資料。</span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <form onSubmit={submit} className="ledger-panel grid gap-3 p-4 md:grid-cols-6">
          <label className="text-sm font-medium">
            違規次數
            <select name="violationCount" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-violation-count">
              <option value="">全部</option>
              <option value="2">第 2 次</option>
              <option value="3+">第 3 次以上</option>
              <option value="4+">第 4 次以上</option>
              <option value="5+">第 5 次以上</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            違規類型
            <select name="type" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-type">
              <option value="">全部</option>
              <option value="酒駕">酒駕</option>
              <option value="毒駕">毒駕／藥駕</option>
              <option value="拒測">拒測</option>
              <option value="無照">無照</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            違規日起
            <input name="dateFrom" type="date" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-date-from" />
          </label>
          <label className="text-sm font-medium">
            違規日迄
            <input name="dateTo" type="date" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-date-to" />
          </label>
          <label className="text-sm font-medium">
            地點關鍵字
            <input name="location" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" placeholder="路名、行政區" data-testid="filter-location" />
          </label>
          <button className="focus-ring mt-7 inline-flex h-10 items-center justify-center gap-2 bg-[var(--signal-red)] px-3 text-sm font-medium text-white transition hover:bg-[var(--civic-green)]" data-testid="apply-filters">
            <Filter size={16} />
            套用篩選
          </button>
        </form>

        <details className="ledger-panel mt-3 p-4 text-sm text-[var(--muted)]">
          <summary className="cursor-pointer font-medium text-[var(--ink)]">進階搜尋與教育用途限制</summary>
          <div className="mt-3 flex items-start gap-2 leading-6">
            <Search className="mt-1 shrink-0" size={16} />
            <span>姓名搜尋預設停用，避免將本網站作為人名查詢工具；資料呈現以交通安全教育、地點與違規樣態分析為主。</span>
          </div>
        </details>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("table")} className={`focus-ring border px-4 py-2 text-sm font-medium transition ${activeTab === "table" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--civic-green)]"}`}>
              資料表
            </button>
            <button onClick={() => setActiveTab("map")} className={`focus-ring inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium transition ${activeTab === "map" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--civic-green)]"}`} data-testid="map-tab">
              <MapPinned size={16} />
              地圖
            </button>
          </div>
          <div className="text-sm text-[var(--muted)]" data-testid="visible-record-count">
            目前顯示 {records.length} 筆
          </div>
        </div>

        {activeTab === "table" ? (
          <div className="ledger-panel overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-[var(--paper-strong)] text-left text-[var(--ink)]">
                <tr>
                  <th className="p-3 font-semibold">姓名</th>
                  <th className="p-3 font-semibold">違規日期</th>
                  <th className="p-3 font-semibold">累犯次數</th>
                  <th className="p-3 font-semibold">違規類型</th>
                  <th className="p-3 font-semibold">違規地點</th>
                  <th className="p-3 font-semibold">酒測值</th>
                  <th className="p-3 font-semibold">來源公告</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="p-6 text-center text-[var(--muted)]" colSpan={7}>
                      資料載入中...
                    </td>
                  </tr>
                ) : records.length ? (
                  records.map((record) => (
                    <tr key={record.id} className="border-t border-[var(--line)] transition hover:bg-[#fbf3e5]" data-testid="record-row">
                      <td className="p-3">{record.name ?? "未載明"}</td>
                      <td className="p-3">{formatDate(record.violation_date)}</td>
                      <td className="p-3">{record.violation_count ? `第 ${record.violation_count} 次` : "未判讀"}</td>
                      <td className="p-3">{parseTypes(record.violation_types_json)}</td>
                      <td className="p-3">{record.location_text ?? "未載明"}</td>
                      <td className="p-3">{record.alcohol_mg_per_l ? `${record.alcohol_mg_per_l} mg/L` : "未載明"}</td>
                      <td className="p-3">
                        <a href={record.pdf_url} className="focus-ring text-[var(--civic-blue)] underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--signal-red)]" target="_blank" rel="noreferrer">
                          {record.source_title}
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-8 text-center text-[var(--muted)]" colSpan={7}>
                      尚無符合條件的公告資料。可至匯入管理新增 PDF 或重新爬取來源頁。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <LocationMap locations={locations} />
        )}
      </section>

      <footer className="mx-auto max-w-7xl px-4 pb-8 md:px-8">
        <div className="ledger-panel flex items-start gap-3 p-4 text-sm leading-6 text-[var(--muted)]">
          <ShieldCheck className="mt-1 shrink-0 text-[var(--civic-green)]" size={18} />
          <p>本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。</p>
        </div>
      </footer>
    </main>
  );
}
