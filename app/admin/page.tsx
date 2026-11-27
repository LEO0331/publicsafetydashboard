"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, Globe2, KeyRound, ListRestart, MapPinned, RefreshCw, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import LanguageToggle from "../../src/components/LanguageToggle";
import SecurityOperations from "../../src/components/SecurityOperations";
import { adminCopy, usePersistedLanguage } from "../../src/components/uiLanguage";
import { AdminRequest, useAdminSession } from "../../src/components/adminSession";
import type { Language } from "../../src/components/uiLanguage";

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

type AdminData = {
  logs: string[];
  reviewItems: ReviewItem[];
  reviewCount: number;
  sources: SourceItem[];
};

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) return {};
  const body = await response.json().catch(() => ({}));
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

async function loadAdminData(request: AdminRequest): Promise<AdminData> {
  const [logsRes, reviewRes] = await Promise.all([
    request("/api/import/logs"),
    request("/api/admin/review"),
  ]);
  const [logsBody, reviewBody] = await Promise.all([jsonObject(logsRes), jsonObject(reviewRes)]);

  return {
    logs: Array.isArray(logsBody.logs) ? logsBody.logs : [],
    reviewItems: Array.isArray(reviewBody.reviewItems) ? reviewBody.reviewItems : [],
    reviewCount: typeof reviewBody.reviewCount === "number" ? reviewBody.reviewCount : 0,
    sources: Array.isArray(reviewBody.sources) ? reviewBody.sources : [],
  };
}

function AdminWorkspace({ language, request, signal }: { language: Language; request: AdminRequest; signal: AbortSignal }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const t = adminCopy[language];

  function setAdminData(data: AdminData) {
    setLogs(data.logs);
    setReviewItems(data.reviewItems);
    setReviewCount(data.reviewCount);
    setSources(data.sources);
  }

  useEffect(() => {
    let cancelled = false;
    void loadAdminData(request).then((data) => {
      if (!cancelled && !signal.aborted) setAdminData(data);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [request, signal]);

  async function runImport(action: () => Promise<Response>) {
    setIsRunning(true);
    try {
      const res = await action();
      const result = await res.text();
      if (signal.aborted) return;
      setMessage(result);
      const data = await loadAdminData(request);
      if (!signal.aborted) setAdminData(data);
    } catch (error) {
      if (!signal.aborted) setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      if (!signal.aborted) setIsRunning(false);
    }
  }

  async function setHidden(target: "source" | "record", id: number, hidden: boolean) {
    await runImport(() =>
      request("/api/admin/hide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, id, hidden }),
      })
    );
  }

  async function crawl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      request("/api/import/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxPages: form.get("maxPages") || undefined }),
      })
    );
  }

  async function importUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      request("/api/import/pdf-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.get("url"), title: form.get("title") }),
      })
    );
  }

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      request("/api/import/pdf-file", {
        method: "POST",
        body: form,
      })
    );
  }

  async function geocode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runImport(() =>
      request("/api/import/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: form.get("limit") || undefined, delay: form.get("delay") || undefined }),
      })
    );
  }

  return (
    <>
      <SecurityOperations request={request} signal={signal} language={language} />

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
            <h2 id="admin-review-title" className="font-medium">{t.reviewTitle} ({reviewCount})</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t.reviewHint}</p>
            {reviewCount > reviewItems.length ? (
              <p className="mt-2 text-xs text-[var(--muted)]">{t.reviewShown(reviewItems.length, reviewCount)}</p>
            ) : null}
            <div className="focus-ring mt-3 max-h-96 space-y-2 overflow-auto" role="region" aria-labelledby="admin-review-title" tabIndex={0} data-testid="admin-review-rows">
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
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t.sourceHint}</p>
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
    </>
  );
}

export default function AdminPage() {
  const { language, chooseLanguage } = usePersistedLanguage();
  const [token, setToken] = useState("");
  const auth = useAdminSession();
  const t = adminCopy[language];

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await auth.login(token)) setToken("");
  }

  return <main className="min-h-screen text-[var(--ink)]" data-testid="admin-page">
    <header className="border-b border-[var(--line)] bg-[var(--paper-strong)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 border border-[var(--civic-green)] px-2 py-1 text-xs font-semibold text-[var(--civic-green)]"><ListRestart size={14} />{t.badge}</div>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageToggle language={language} label={t.languageLabel} onChange={chooseLanguage} testIdPrefix="admin-language" />
          <Link href="/" className="focus-ring inline-flex items-center justify-center gap-2 border border-[var(--ink)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--ink)] hover:text-white"><ArrowLeft size={16} />{t.back}</Link>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      {auth.session ? <section className="ledger-panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <span role="status" data-testid="admin-auth-status" className="inline-flex items-center gap-2 font-medium"><KeyRound size={16} />{t.authenticated}</span>
        <button type="button" onClick={() => void auth.logout()} disabled={auth.busy} className="focus-ring border border-[var(--ink)] px-4 py-2 disabled:opacity-50" data-testid="admin-logout">{t.logout}</button>
      </section> : <form onSubmit={login} className="ledger-panel space-y-3 p-4 text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label htmlFor="admin-token" className="inline-flex shrink-0 items-center gap-2 font-medium md:w-40"><KeyRound size={16} />{t.adminToken}</label>
          <input id="admin-token" value={token} onChange={event => setToken(event.target.value)} disabled={auth.checking || auth.busy} className="focus-ring min-w-0 flex-1 border border-[var(--line)] bg-white p-2" type="password" autoComplete="off" maxLength={4096} required placeholder={t.tokenPlaceholder} data-testid="admin-token" />
          <button disabled={auth.checking || auth.busy || !token} className="focus-ring shrink-0 bg-[var(--ink)] px-4 py-2 text-white disabled:opacity-50" data-testid="admin-login">{auth.busy ? t.authBusy : t.login}</button>
        </div>
        <p role="status" data-testid="admin-auth-status" className="text-[var(--muted)]">{auth.checking ? t.authChecking : auth.error ? t.authErrors[auth.error] : t.authPrompt}</p>
      </form>}
      {auth.session && <AdminWorkspace language={language} request={auth.request} signal={auth.session.controller.signal} />}
    </div>
  </main>;
}
