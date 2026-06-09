"use client";

import { useEffect, useState } from "react";

export type Language = "zh" | "en";

const LANGUAGE_STORAGE_KEY = "publicSafetyDashboard.language";

export const dashboardCopy = {
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

export const adminCopy = {
  zh: {
    badge: "公告匯入作業",
    title: "匯入管理",
    subtitle: "爬取政府公告頁、匯入 PDF 網址或上傳本機 PDF。所有來源與解析結果會寫入匯入紀錄。",
    languageLabel: "介面語言",
    back: "返回儀表板",
    adminToken: "管理權杖",
    tokenPlaceholder: "請輸入 ADMIN_TOKEN",
    crawlTitle: "政府頁面爬取",
    crawlDescription: "依分頁循序抓取 PDF 連結，保留來源網址與公告標題。",
    maxPagesPlaceholder: "最多頁數，可留空",
    startCrawl: "開始爬取",
    urlTitle: "PDF 網址匯入",
    urlDescription: "匯入單一公告 PDF，下載後以內容雜湊去重。",
    titlePlaceholder: "公告標題",
    urlPlaceholder: "PDF 網址",
    importUrl: "匯入網址",
    fileTitle: "本機 PDF 匯入",
    fileDescription: "適合人工下載後測試解析品質，資料仍會進入同一個 SQLite 資料庫。",
    uploadFile: "上傳解析",
    geocodeTitle: "地圖座標產生",
    geocodeDescription: "將尚未定位或先前失敗的違規地點送至 Nominatim，結果會快取到資料庫。只傳送地點文字；若遇到 429，請稍後再分批重試。",
    geocodeLimitPlaceholder: "最多地點數，預設 5",
    geocodeDelayPlaceholder: "每筆延遲秒數，預設 10",
    startGeocode: "產生地圖座標",
    logsTitle: "解析紀錄",
    noLogs: "目前尚無匯入紀錄。",
  },
  en: {
    badge: "Announcement Import Operations",
    title: "Import Admin",
    subtitle: "Crawl the government listing page, import a PDF URL, or upload a local PDF. Sources and parsing results are written to the import log.",
    languageLabel: "Interface Language",
    back: "Back to Dashboard",
    adminToken: "Admin Token",
    tokenPlaceholder: "Enter ADMIN_TOKEN",
    crawlTitle: "Government Page Crawl",
    crawlDescription: "Sequentially crawls paginated PDF links and stores source URLs and announcement titles.",
    maxPagesPlaceholder: "Maximum pages, optional",
    startCrawl: "Start Crawl",
    urlTitle: "PDF URL Import",
    urlDescription: "Imports one announcement PDF and deduplicates it by content hash after download.",
    titlePlaceholder: "Announcement title",
    urlPlaceholder: "PDF URL",
    importUrl: "Import URL",
    fileTitle: "Local PDF Import",
    fileDescription: "Use this for manually downloaded PDFs when testing parser quality. Records are stored in the same SQLite database.",
    uploadFile: "Upload and Parse",
    geocodeTitle: "Generate Map Coordinates",
    geocodeDescription: "Sends ungeocoded or previously failed locations to Nominatim and caches results in the database. Only location text is sent; if you hit 429, retry later in small batches.",
    geocodeLimitPlaceholder: "Maximum locations, default 5",
    geocodeDelayPlaceholder: "Delay seconds per lookup, default 10",
    startGeocode: "Generate Coordinates",
    logsTitle: "Parser Logs",
    noLogs: "No import logs yet.",
  },
} as const;

export const mapCopy = {
  zh: {
    title: "地點清單",
    subtitle: "預設顯示事件數最高的地點，降低地圖釘點密度。",
    searchPlaceholder: "搜尋地點",
    showing: (visible: number, total: number) => `顯示 ${visible} / ${total} 個可定位地點`,
    hidden: (hidden: number) => `另有 ${hidden} 個地點已收合，避免地圖過度擁擠。`,
    showAll: "顯示全部",
    showLess: "只看高頻地點",
    noGeocoded: "目前尚無可定位地點，請先執行地理編碼。",
    noMatches: "沒有符合搜尋條件的可定位地點。",
    incidents: "事件數",
    date: "日期",
    typeBreakdown: "類型",
    to: "至",
    noDate: "無日期",
  },
  en: {
    title: "Location List",
    subtitle: "Shows the highest-incident locations first to keep the map readable.",
    searchPlaceholder: "Search location",
    showing: (visible: number, total: number) => `Showing ${visible} of ${total} geocoded locations`,
    hidden: (hidden: number) => `${hidden} more locations are folded to avoid marker clutter.`,
    showAll: "Show All",
    showLess: "Top Locations Only",
    noGeocoded: "No geocoded locations yet. Run geocoding first.",
    noMatches: "No geocoded locations match this search.",
    incidents: "Incidents",
    date: "Date",
    typeBreakdown: "Types",
    to: "to",
    noDate: "No date",
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

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en";
}

export function separatorFor(language: Language) {
  return language === "zh" ? "、" : ", ";
}

export function formatDate(value: number | null, language: Language, fallback: string) {
  return value ? new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-US").format(new Date(value)) : fallback;
}

export function formatViolationType(type: string, language: Language) {
  return typeLabels[type]?.[language] ?? type;
}

export function formatViolationTypesJson(value: string | null, language: Language, fallback: string) {
  try {
    const types = JSON.parse(value || "[]") as string[];
    return types.map((type) => formatViolationType(type, language)).join(separatorFor(language)) || fallback;
  } catch {
    return fallback;
  }
}

export function formatViolationCount(value: number | null | undefined, language: Language, fallback: string) {
  if (!value) return fallback;
  return language === "zh" ? `第 ${value} 次` : `Repeat #${value}`;
}

export function usePersistedLanguage() {
  const [language, setLanguage] = useState<Language>("zh");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!isLanguage(savedLanguage)) return;
    const timer = window.setTimeout(() => setLanguage(savedLanguage), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }

  return { language, chooseLanguage };
}
