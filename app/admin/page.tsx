"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, Globe2, KeyRound, ListRestart, RefreshCw, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Language = "zh" | "en";

const copy = {
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
    logsTitle: "Parser Logs",
    noLogs: "No import logs yet.",
  },
} as const;

export default function AdminPage() {
  const [language, setLanguage] = useState<Language>("zh");
  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const t = copy[language];

  async function loadLogs(adminToken = token) {
    if (!adminToken) {
      setLogs([]);
      return;
    }
    const res = await fetch("/api/import/logs", {
      headers: { "x-admin-token": adminToken },
    });
    const body = await res.json();
    setLogs(Array.isArray(body.logs) ? body.logs : []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      const res = await fetch("/api/import/logs", {
        headers: { "x-admin-token": token },
      });
      const body = await res.json();
      if (!cancelled) setLogs(Array.isArray(body.logs) ? body.logs : []);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function runImport(action: () => Promise<Response>) {
    setIsRunning(true);
    const res = await action();
    setMessage(await res.text());
    await loadLogs();
    setIsRunning(false);
  }

  async function crawl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      fetch("/api/import/crawl", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ maxPages: form.get("maxPages") || undefined }),
      })
    );
  }

  async function importUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      fetch("/api/import/pdf-url", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ url: form.get("url"), title: form.get("title") }),
      })
    );
  }

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      fetch("/api/import/pdf-file", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: form,
      })
    );
  }

  return (
    <main className="min-h-screen text-[var(--ink)]" data-testid="admin-page">
      <header className="border-b border-[var(--line)] bg-[var(--paper-strong)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 md:flex-row md:items-end md:justify-between md:px-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 border border-[var(--civic-green)] px-2 py-1 text-xs font-semibold text-[var(--civic-green)]">
              <ListRestart size={14} />
              {t.badge}
            </div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border border-[var(--line)] bg-white text-xs font-semibold" aria-label={t.languageLabel}>
              <button type="button" onClick={() => setLanguage("zh")} className={`focus-ring px-2 py-1 ${language === "zh" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid="admin-language-zh">
                中文
              </button>
              <button type="button" onClick={() => setLanguage("en")} className={`focus-ring px-2 py-1 ${language === "en" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`} data-testid="admin-language-en">
                English
              </button>
            </div>
            <Link href="/" className="focus-ring inline-flex items-center justify-center gap-2 border border-[var(--ink)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--ink)] hover:text-white">
              <ArrowLeft size={16} />
              {t.back}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <label className="ledger-panel flex flex-col gap-2 p-4 text-sm font-medium md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2 md:w-40">
            <KeyRound size={16} />
            {t.adminToken}
          </span>
          <input value={token} onChange={(event) => setToken(event.target.value)} className="focus-ring w-full border border-[var(--line)] bg-white p-2 font-normal" type="password" placeholder={t.tokenPlaceholder} data-testid="admin-token" />
        </label>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <form onSubmit={crawl} className="ledger-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t.crawlTitle}</h2>
              <Globe2 className="text-[var(--civic-green)]" size={18} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.crawlDescription}</p>
            <input name="maxPages" className="focus-ring mt-4 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.maxPagesPlaceholder} />
            <button disabled={isRunning} className="focus-ring mt-3 inline-flex items-center gap-2 bg-[var(--ink)] px-3 py-2 text-sm text-white transition hover:bg-[var(--civic-green)] disabled:opacity-50">
              <RefreshCw size={16} />
              {t.startCrawl}
            </button>
          </form>

          <form onSubmit={importUrl} className="ledger-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t.urlTitle}</h2>
              <Upload className="text-[var(--signal-red)]" size={18} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.urlDescription}</p>
            <input name="title" className="focus-ring mt-4 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.titlePlaceholder} />
            <input name="url" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.urlPlaceholder} data-testid="pdf-url-input" />
            <button disabled={isRunning} className="focus-ring mt-3 inline-flex items-center gap-2 bg-[var(--ink)] px-3 py-2 text-sm text-white transition hover:bg-[var(--civic-green)] disabled:opacity-50" data-testid="import-url-button">
              <Upload size={16} />
              {t.importUrl}
            </button>
          </form>

          <form onSubmit={importFile} className="ledger-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t.fileTitle}</h2>
              <FileUp className="text-[var(--amber)]" size={18} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.fileDescription}</p>
            <input name="title" className="focus-ring mt-4 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.titlePlaceholder} />
            <input name="file" type="file" accept="application/pdf" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 text-sm" />
            <button disabled={isRunning} className="focus-ring mt-3 inline-flex items-center gap-2 bg-[var(--ink)] px-3 py-2 text-sm text-white transition hover:bg-[var(--civic-green)] disabled:opacity-50">
              <FileUp size={16} />
              {t.uploadFile}
            </button>
          </form>
        </div>

        {message ? (
          <pre className="ledger-panel mt-5 overflow-auto p-4 text-xs leading-5" data-testid="admin-result">
            {message}
          </pre>
        ) : null}

        <section className="ledger-panel mt-5 p-4">
          <h2 className="font-medium">{t.logsTitle}</h2>
          <pre className="mt-3 max-h-96 overflow-auto bg-[#fbf7ee] p-3 text-xs leading-5 text-[var(--muted)]">{logs.length ? logs.join("\n") : t.noLogs}</pre>
        </section>
      </div>
    </main>
  );
}
