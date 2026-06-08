"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Database, FileText, Filter, MapPinned, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import LanguageToggle from "./LanguageToggle";
import { dashboardCopy, formatDate, formatViolationCount, formatViolationType, formatViolationTypesJson, Language, usePersistedLanguage } from "./uiLanguage";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => <div className="ledger-panel flex h-[520px] items-center justify-center text-sm text-[var(--muted)]">地圖載入中 / Loading map...</div>,
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

function statLine(items: { value?: number | null; type?: string; count: number }[] | undefined, language: Language) {
  if (!items?.length) return dashboardCopy[language].noData;
  return items
    .map((item) => {
      const label = item.type ? formatViolationType(item.type, language) : formatViolationCount(item.value, language, dashboardCopy[language].unknown);
      return language === "zh" ? `${label} ${item.count} 筆` : `${label}: ${item.count}`;
    })
    .join(language === "zh" ? "、" : "; ");
}

export default function Dashboard() {
  const { language, chooseLanguage } = usePersistedLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"table" | "map">("table");
  const [filters, setFilters] = useState({ violationCount: "", type: "", location: "", dateFrom: "", dateTo: "" });
  const [isLoading, setIsLoading] = useState(true);
  const t = dashboardCopy[language];

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
        {t.skip}
      </a>
      <header className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--paper-strong)]">
        <div className="absolute inset-y-0 left-0 hidden w-4 notice-rail md:block" />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 md:grid-cols-[1fr_auto] md:px-8 md:py-10">
          <div className="animate-ledger-in">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--civic-green)]">
              <span className="border border-[var(--civic-green)] px-2 py-1">{t.badgeEducation}</span>
              <span className="stamp px-2 py-1">{t.badgePublic}</span>
            </div>
            <h1 className="font-display max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">{t.subtitle}</p>
          </div>
          <div className="ledger-panel animate-ledger-in flex min-w-64 flex-col justify-between p-4 [animation-delay:120ms]">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--muted)]">
              <span>{t.dataMaintenance}</span>
              <LanguageToggle language={language} label={t.languageLabel} onChange={chooseLanguage} />
            </div>
            <div className="mt-4 text-sm leading-6">{t.maintenanceText}</div>
            <Link href="/admin" className="focus-ring mt-5 inline-flex items-center justify-center gap-2 bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--civic-green)]">
              <RefreshCw size={16} />
              {t.adminLink}
            </Link>
          </div>
        </div>
      </header>

      <section id="dashboard-content" className="mx-auto grid max-w-7xl gap-3 px-4 py-5 md:grid-cols-4 md:px-8">
        <article className="ledger-panel animate-ledger-in p-4">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>{t.totalRecords}</span>
            <Database size={18} />
          </div>
          <div className="mt-3 text-4xl font-semibold" data-testid="total-records">
            {stats?.totalRecords ?? 0}
          </div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:60ms]">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>{t.announcements}</span>
            <FileText size={18} />
          </div>
          <div className="mt-3 text-4xl font-semibold" data-testid="announcement-count">
            {stats?.announcements ?? 0}
          </div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:120ms]">
          <div className="text-sm text-[var(--muted)]">{t.byCount}</div>
          <div className="mt-3 text-sm leading-6">{statLine(stats?.byCount, language)}</div>
        </article>
        <article className="ledger-panel animate-ledger-in p-4 [animation-delay:180ms]">
          <div className="text-sm text-[var(--muted)]">{t.byType}</div>
          <div className="mt-3 text-sm leading-6">{statLine(stats?.byType, language)}</div>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-5 md:px-8">
        <div className="ledger-panel grid gap-3 p-4 md:grid-cols-[220px_1fr]">
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">{t.topLocations}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{t.topLocationsHint}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats?.topLocations.length ? (
              stats.topLocations.map((item) => (
                <span key={item.location} className="border border-[var(--line)] bg-[#fbf7ee] px-3 py-1 text-sm">
                  {language === "zh" ? `${item.location}：${item.count} ${t.recordUnit}` : `${item.location}: ${item.count} ${t.recordUnit}`}
                </span>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)]">{t.noLocationStats}</span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <form onSubmit={submit} className="ledger-panel grid gap-3 p-4 md:grid-cols-6">
          <label className="text-sm font-medium">
            {t.violationCount}
            <select name="violationCount" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-violation-count">
              <option value="">{t.all}</option>
              <option value="2">{t.count2}</option>
              <option value="3+">{t.count3Plus}</option>
              <option value="4+">{t.count4Plus}</option>
              <option value="5+">{t.count5Plus}</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            {t.violationType}
            <select name="type" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-type">
              <option value="">{t.all}</option>
              <option value="酒駕">{t.drunkDriving}</option>
              <option value="毒駕">{t.drugDriving}</option>
              <option value="拒測">{t.refusal}</option>
              <option value="無照">{t.unlicensed}</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            {t.dateFrom}
            <input name="dateFrom" type="date" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-date-from" />
          </label>
          <label className="text-sm font-medium">
            {t.dateTo}
            <input name="dateTo" type="date" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" data-testid="filter-date-to" />
          </label>
          <label className="text-sm font-medium">
            {t.locationKeyword}
            <input name="location" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 font-normal" placeholder={t.locationPlaceholder} data-testid="filter-location" />
          </label>
          <button className="focus-ring mt-7 inline-flex h-10 items-center justify-center gap-2 bg-[var(--signal-red)] px-3 text-sm font-medium text-white transition hover:bg-[var(--civic-green)]" data-testid="apply-filters">
            <Filter size={16} />
            {t.applyFilters}
          </button>
        </form>

        <details className="ledger-panel mt-3 p-4 text-sm text-[var(--muted)]">
          <summary className="cursor-pointer font-medium text-[var(--ink)]">{t.advancedSummary}</summary>
          <div className="mt-3 flex items-start gap-2 leading-6">
            <Search className="mt-1 shrink-0" size={16} />
            <span>{t.advancedText}</span>
          </div>
        </details>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("table")} className={`focus-ring border px-4 py-2 text-sm font-medium transition ${activeTab === "table" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--civic-green)]"}`}>
              {t.tableTab}
            </button>
            <button onClick={() => setActiveTab("map")} className={`focus-ring inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium transition ${activeTab === "map" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--civic-green)]"}`} data-testid="map-tab">
              <MapPinned size={16} />
              {t.mapTab}
            </button>
          </div>
          <div className="text-sm text-[var(--muted)]" data-testid="visible-record-count">
            {t.visibleRecords(records.length)}
          </div>
        </div>

        {activeTab === "table" ? (
          <div className="ledger-panel overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-[var(--paper-strong)] text-left text-[var(--ink)]">
                <tr>
                  {t.tableHeaders.map((header) => (
                    <th key={header} className="p-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="p-6 text-center text-[var(--muted)]" colSpan={7}>
                      {t.loading}
                    </td>
                  </tr>
                ) : records.length ? (
                  records.map((record) => (
                    <tr key={record.id} className="border-t border-[var(--line)] transition hover:bg-[#fbf3e5]" data-testid="record-row">
                      <td className="p-3">{record.name ?? t.notProvided}</td>
                      <td className="p-3">{formatDate(record.violation_date, language, t.notProvided)}</td>
                      <td className="p-3">{formatViolationCount(record.violation_count, language, t.unknown)}</td>
                      <td className="p-3">{formatViolationTypesJson(record.violation_types_json, language, t.unknown)}</td>
                      <td className="p-3">{record.location_text ?? t.notProvided}</td>
                      <td className="p-3">{record.alcohol_mg_per_l ? `${record.alcohol_mg_per_l} mg/L` : t.notProvided}</td>
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
                      {t.emptyRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <LocationMap locations={locations} language={language} />
        )}
      </section>

      <footer className="mx-auto max-w-7xl px-4 pb-8 md:px-8">
        <div className="ledger-panel flex items-start gap-3 p-4 text-sm leading-6 text-[var(--muted)]">
          <ShieldCheck className="mt-1 shrink-0 text-[var(--civic-green)]" size={18} />
          <p>{t.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}
