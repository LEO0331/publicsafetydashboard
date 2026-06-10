"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, Globe2, KeyRound, ListRestart, MapPinned, RefreshCw, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import LanguageToggle from "../../src/components/LanguageToggle";
import { adminCopy, usePersistedLanguage } from "../../src/components/uiLanguage";

type ReviewItem = {
  id: number;
  name: string | null;
  location_text: string | null;
  parser_confidence: number | null;
  source_title: string;
};

type SourceItem = {
  id: number;
  title: string;
  parse_status: string;
  is_hidden: number;
  record_count: number;
  review_count: number;
};

export default function AdminPage() {
  const { language, chooseLanguage } = usePersistedLanguage();
  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const t = adminCopy[language];

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

  async function loadReviewData(adminToken = token) {
    if (!adminToken) {
      setReviewItems([]);
      setSources([]);
      return;
    }
    const res = await fetch("/api/admin/review", {
      headers: { "x-admin-token": adminToken },
    });
    if (!res.ok) {
      setReviewItems([]);
      setSources([]);
      return;
    }
    const body = await res.json();
    setReviewItems(Array.isArray(body.reviewItems) ? body.reviewItems : []);
    setSources(Array.isArray(body.sources) ? body.sources : []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      const res = await fetch("/api/import/logs", {
        headers: { "x-admin-token": token },
      });
      const [logsBody, reviewRes] = await Promise.all([res.json(), fetch("/api/admin/review", { headers: { "x-admin-token": token } })]);
      const reviewBody = reviewRes.ok ? await reviewRes.json() : { reviewItems: [], sources: [] };
      if (!cancelled) {
        setLogs(Array.isArray(logsBody.logs) ? logsBody.logs : []);
        setReviewItems(Array.isArray(reviewBody.reviewItems) ? reviewBody.reviewItems : []);
        setSources(Array.isArray(reviewBody.sources) ? reviewBody.sources : []);
      }
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
    await loadReviewData();
    setIsRunning(false);
  }

  async function setHidden(target: "source" | "record", id: number, hidden: boolean) {
    await runImport(() =>
      fetch("/api/admin/hide", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ target, id, hidden }),
      })
    );
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

  async function geocode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      fetch("/api/import/geocode", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ limit: form.get("limit") || undefined, delay: form.get("delay") || undefined }),
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
            <LanguageToggle language={language} label={t.languageLabel} onChange={chooseLanguage} testIdPrefix="admin-language" />
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

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

          <form onSubmit={geocode} className="ledger-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t.geocodeTitle}</h2>
              <MapPinned className="text-[var(--civic-blue)]" size={18} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.geocodeDescription}</p>
            <input name="limit" className="focus-ring mt-4 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.geocodeLimitPlaceholder} />
            <input name="delay" className="focus-ring mt-2 w-full border border-[var(--line)] bg-white p-2 text-sm" placeholder={t.geocodeDelayPlaceholder} />
            <button disabled={isRunning} className="focus-ring mt-3 inline-flex items-center gap-2 bg-[var(--ink)] px-3 py-2 text-sm text-white transition hover:bg-[var(--civic-green)] disabled:opacity-50" data-testid="geocode-button">
              <MapPinned size={16} />
              {t.startGeocode}
            </button>
          </form>
        </div>

        {message ? (
          <pre className="ledger-panel mt-5 overflow-auto p-4 text-xs leading-5" data-testid="admin-result">
            {message}
          </pre>
        ) : null}

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="ledger-panel p-4">
            <h2 className="font-medium">{t.reviewTitle}</h2>
            <div className="mt-3 space-y-2" data-testid="admin-review-rows">
              {reviewItems.length ? (
                reviewItems.map((item) => (
                  <div key={item.id} className="border border-[var(--line)] bg-[#fbf7ee] p-3 text-sm">
                    <div className="font-medium">{item.name ?? "未載明"} · {item.location_text ?? "未載明"}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.source_title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">confidence: {item.parser_confidence ?? 0}</div>
                    <button type="button" disabled={isRunning} onClick={() => setHidden("record", item.id, true)} className="focus-ring mt-2 border border-[var(--signal-red)] px-3 py-1 text-xs font-medium text-[var(--signal-red)] disabled:opacity-50">
                      {t.hide}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">{t.noReviewRows}</p>
              )}
            </div>
          </div>

          <div className="ledger-panel p-4">
            <h2 className="font-medium">{t.sourcesTitle}</h2>
            <div className="mt-3 max-h-96 space-y-2 overflow-auto" data-testid="admin-source-list">
              {sources.map((source) => {
                const hidden = Boolean(source.is_hidden);
                return (
                  <div key={source.id} className="border border-[var(--line)] bg-[#fbf7ee] p-3 text-sm">
                    <div className="font-medium">{source.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {source.parse_status} · {source.record_count} records · {source.review_count} review
                    </div>
                    <button type="button" disabled={isRunning} onClick={() => setHidden("source", source.id, !hidden)} className="focus-ring mt-2 border border-[var(--ink)] px-3 py-1 text-xs font-medium disabled:opacity-50" data-testid={`source-hide-${source.id}`}>
                      {hidden ? t.unhide : t.hide}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ledger-panel mt-5 p-4">
          <h2 className="font-medium">{t.logsTitle}</h2>
          <pre className="mt-3 max-h-96 overflow-auto bg-[#fbf7ee] p-3 text-xs leading-5 text-[var(--muted)]">{logs.length ? logs.join("\n") : t.noLogs}</pre>
        </section>
      </div>
    </main>
  );
}
