"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Database, FileText, Filter, MapPinned, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => <div className="ledger-panel flex h-[520px] items-center justify-center text-sm text-[var(--muted)]">地圖載入中 / Loading map...</div>,
});

type Language = "zh" | "en";

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

const copy = {
  zh: {
    skip: "跳至主要內容",
    badgeEducation: "交通安全教育資料",
    badgePublic: "公開公告",
    title: "臺北市酒駕／毒駕／拒測累犯教育儀表板",
    subtitle: "彙整臺北市政府公開 PDF 公告，協助學生以資料方式理解交通風險、重複違規樣態與地點分布。",
    languageLabel: "介面語言",
    dataMaintenance: "資料維護",
    maintenanceText: "匯入作業需使用管理權杖，避免非預期爬取或重複解析。",
    adminLink: "前往匯入管理",
    totalRecords: "公告紀錄總筆數",
    announcements: "已匯入公告",
    byCount: "依違規次數",
    byType: "依違規類型",
    topLocations: "高頻違規地點",
    topLocationsHint: "依目前匯入資料統計",
    noLocationStats: "尚無地點統計資料。",
    recordUnit: "筆",
    noData: "尚無資料",
    unknown: "未判讀",
    notProvided: "未載明",
    all: "全部",
    violationCount: "違規次數",
    count2: "第 2 次",
    count3Plus: "第 3 次以上",
    count4Plus: "第 4 次以上",
    count5Plus: "第 5 次以上",
    violationType: "違規類型",
    drunkDriving: "酒駕",
    drugDriving: "毒駕／藥駕",
    refusal: "拒測",
    unlicensed: "無照",
    dateFrom: "違規日起",
    dateTo: "違規日迄",
    locationKeyword: "地點關鍵字",
    locationPlaceholder: "路名、行政區",
    applyFilters: "套用篩選",
    advancedSummary: "進階搜尋與教育用途限制",
    advancedText: "姓名搜尋預設停用，避免將本網站作為人名查詢工具；資料呈現以交通安全教育、地點與違規樣態分析為主。",
    tableTab: "資料表",
    mapTab: "地圖",
    visibleRecords: (count: number) => `目前顯示 ${count} 筆`,
    tableHeaders: ["姓名", "違規日期", "累犯次數", "違規類型", "違規地點", "酒測值", "來源公告"],
    loading: "資料載入中...",
    emptyRecords: "尚無符合條件的公告資料。可至匯入管理新增 PDF 或重新爬取來源頁。",
    disclaimer: "本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。",
  },
  en: {
    skip: "Skip to main content",
    badgeEducation: "Traffic Safety Education Data",
    badgePublic: "Public Announcements",
    title: "Taipei Repeat DUI / Drug-Impaired / Test-Refusal Education Dashboard",
    subtitle: "This dashboard summarizes public Taipei City Government PDF announcements to help students understand traffic-safety risks, repeat-offense patterns, and location distribution.",
    languageLabel: "Interface Language",
    dataMaintenance: "Data Maintenance",
    maintenanceText: "Import actions require an admin token to prevent accidental crawling or repeated parsing.",
    adminLink: "Open Import Admin",
    totalRecords: "Total Announcement Records",
    announcements: "Announcements Imported",
    byCount: "By Repeat Count",
    byType: "By Violation Type",
    topLocations: "Frequent Violation Locations",
    topLocationsHint: "Calculated from currently imported records",
    noLocationStats: "No location statistics yet.",
    recordUnit: "records",
    noData: "No data yet",
    unknown: "Unclassified",
    notProvided: "Not provided",
    all: "All",
    violationCount: "Repeat Count",
    count2: "Repeat #2",
    count3Plus: "Repeat #3+",
    count4Plus: "Repeat #4+",
    count5Plus: "Repeat #5+",
    violationType: "Violation Type",
    drunkDriving: "Drunk driving",
    drugDriving: "Drug-impaired driving",
    refusal: "Test refusal",
    unlicensed: "Unlicensed",
    dateFrom: "Violation Date From",
    dateTo: "Violation Date To",
    locationKeyword: "Location Keyword",
    locationPlaceholder: "Road name or district",
    applyFilters: "Apply Filters",
    advancedSummary: "Advanced Search and Education-Use Limits",
    advancedText: "Name search is disabled by default so this site is not used as a people-search tool. The dashboard focuses on traffic-safety education, locations, and violation patterns.",
    tableTab: "Table",
    mapTab: "Map",
    visibleRecords: (count: number) => `Showing ${count} records`,
    tableHeaders: ["Name", "Violation Date", "Repeat Count", "Violation Type", "Location", "Alcohol Level", "Source Announcement"],
    loading: "Loading records...",
    emptyRecords: "No matching announcement records. Add a PDF from Import Admin or crawl the source page again.",
    disclaimer: "Data comes from public Taipei City Government announcements and is provided only for traffic-safety education and data-visualization demonstration. If the original announcement is corrected, removed, or updated, the competent authority's latest announcement prevails.",
  },
} as const;

const typeLabels: Record<string, Record<Language, string>> = {
  酒駕: { zh: "酒駕", en: "Drunk driving" },
  毒駕: { zh: "毒駕", en: "Drug-impaired driving" },
  藥駕: { zh: "藥駕", en: "Drug-impaired driving" },
  吸食毒品: { zh: "吸食毒品", en: "Drug use" },
  拒測: { zh: "拒測", en: "Test refusal" },
  無照: { zh: "無照", en: "Unlicensed" },
};

function formatDate(value: number | null, language: Language) {
  return value ? new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-US").format(new Date(value)) : copy[language].notProvided;
}

function formatType(type: string, language: Language) {
  return typeLabels[type]?.[language] ?? type;
}

function parseTypes(value: string | null, language: Language) {
  try {
    const types = JSON.parse(value || "[]") as string[];
    return types.map((type) => formatType(type, language)).join(language === "zh" ? "、" : ", ") || copy[language].unknown;
  } catch {
    return copy[language].unknown;
  }
}

function formatCount(value: number | null | undefined, language: Language) {
  if (!value) return copy[language].unknown;
  return language === "zh" ? `第 ${value} 次` : `Repeat #${value}`;
}

function statLine(items: { value?: number | null; type?: string; count: number }[] | undefined, language: Language) {
  if (!items?.length) return copy[language].noData;
  return items
    .map((item) => {
      const label = item.type ? formatType(item.type, language) : formatCount(item.value, language);
      return language === "zh" ? `${label} ${item.count} 筆` : `${label}: ${item.count}`;
    })
    .join(language === "zh" ? "、" : "; ");
}

export default function Dashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"table" | "map">("table");
  const [filters, setFilters] = useState({ violationCount: "", type: "", location: "", dateFrom: "", dateTo: "" });
  const [isLoading, setIsLoading] = useState(true);
  const t = copy[language];

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
              <div className="flex border border-[var(--line)] bg-white" aria-label={t.languageLabel}>
                <button type="button" onClick={() => setLanguage("zh")} className={`focus-ring px-2 py-1 ${language === "zh" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid="language-zh">
                  中文
                </button>
                <button type="button" onClick={() => setLanguage("en")} className={`focus-ring px-2 py-1 ${language === "en" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid="language-en">
                  English
                </button>
              </div>
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
                      <td className="p-3">{formatDate(record.violation_date, language)}</td>
                      <td className="p-3">{formatCount(record.violation_count, language)}</td>
                      <td className="p-3">{parseTypes(record.violation_types_json, language)}</td>
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
