import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { assertAdmin } from "./admin";
import { ImportBodyTooLargeError, ImportBodyTimeoutError } from "./announcement-import";
import { jsonNoStore } from "./http";

export const ROUTES = ["records", "export", "stats", "locations", "admin_review", "admin_hide", "import_logs", "import_crawl", "import_url", "import_file", "import_geocode", "security_report", "unknown_api"] as const;
export type Route = typeof ROUTES[number];
const CLIENTS = ["browser_like", "claimed_bot", "automated_client", "suspected_scanner", "unknown"] as const;
const PROBES = ["environment", "git", "traversal", "credentials", "wordpress", "configuration", "backup", "administration", "none"] as const;
const AUTH = ["not_applicable", "accepted", "denied", "unconfigured"] as const;
const STATUS = ["2xx", "3xx", "400", "401", "403", "404", "413", "429", "other_4xx", "503", "other_5xx", "other"] as const;
const LATENCY = [10, 50, 100, 250, 500, 1000, 5000, 30000, 120000] as const;
const WINDOW = 300000, RETENTION = 288, MAX_REQUESTS = 100000;
const zeros = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map(key => [key, 0])) as Record<T, number>;
const statusKey = (status: number): typeof STATUS[number] => {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  const exact = String(status) as typeof STATUS[number];
  if (STATUS.includes(exact)) return exact;
  if (status >= 400 && status < 500) return "other_4xx";
  if (status >= 500 && status < 600) return "other_5xx";
  return "other";
};
export function classifyClient(raw: string | null): typeof CLIENTS[number] {
  const ua = raw && raw.length <= 1024 && !/[\x00-\x1f\x7f]/.test(raw) ? raw : "";
  if (/\b(?:sqlmap|nikto|nuclei|masscan|nmap|zgrab)\b/i.test(ua)) return "suspected_scanner";
  if (/\b(?:googlebot|bingbot|duckduckbot|gptbot|claudebot|oai-searchbot|perplexitybot)\b/i.test(ua)) return "claimed_bot";
  if (/\b(?:curl|wget|python-requests|go-http-client|postmanruntime|headlesschrome)\b/i.test(ua)) return "automated_client";
  if (/mozilla\//i.test(ua) && /chrome\/|firefox\/|safari\/|edg\//i.test(ua)) return "browser_like";
  return "unknown";
}
export function classifyProbe(pathname: string): typeof PROBES[number] {
  if (pathname.length > 4096) return "none";
  let path = pathname;
  try {
    for (let i = 0; i < 2 && path.includes("%"); i++) path = decodeURIComponent(path);
  } catch { return "none"; }
  const segments = path.replaceAll("\\", "/").toLowerCase().split("/");
  if (segments.includes("..")) return "traversal";
  if (segments.some(s => /^\.env(?:\.[a-z0-9_-]+)*$/.test(s))) return "environment";
  if (segments.includes(".git")) return "git";
  if (segments.some(s => /^(?:\.aws|\.ssh|\.htpasswd|id_rsa|credentials(?:\.json)?|secrets\.(?:json|ya?ml))$/.test(s))) return "credentials";
  if (segments.some(s => /^(?:wp-admin|wp-login\.php|xmlrpc\.php|wp-config\.php)$/.test(s))) return "wordpress";
  if (segments.some(s => /^(?:config\.(?:php|json|ini|ya?ml)|web\.config|\.htaccess|appsettings\.json)$/.test(s))) return "configuration";
  if (segments.some(s => /^(?:backup|dump|database|site)\.(?:sql|zip|tar|tgz|bak)$/.test(s))) return "backup";
  if (segments.some(s => /^(?:phpmyadmin|adminer\.php|phpinfo\.php|server-status|actuator)$/.test(s))) return "administration";
  return "none";
}
function newRoute() {
  return { requests: 0, rows: 0, status: zeros(STATUS), latency: Array<number>(LATENCY.length + 1).fill(0) };
}
function newCounts() {
  return { requests: 0, dropped: 0, exportResponses: 0, exportRows: 0, clients: zeros(CLIENTS), probes: zeros(PROBES), auth: zeros(AUTH), routes: Object.fromEntries(ROUTES.map(route => [route, newRoute()])) as Record<Route, ReturnType<typeof newRoute>> };
}
type Counts = ReturnType<typeof newCounts>;
type Window = { start: number; counts: Counts };
type Observation = { route: Route; status: number; ms: number; rows?: number; client: typeof CLIENTS[number]; probe: typeof PROBES[number]; auth: typeof AUTH[number] };
function merge(target: Counts, source: Counts) {
  for (const key of ["requests", "dropped", "exportResponses", "exportRows"] as const) target[key] += source[key];
  for (const key of CLIENTS) target.clients[key] += source.clients[key];
  for (const key of PROBES) target.probes[key] += source.probes[key];
  for (const key of AUTH) target.auth[key] += source.auth[key];
  for (const route of ROUTES) {
    const a = target.routes[route], b = source.routes[route];
    a.requests += b.requests; a.rows += b.rows;
    for (const key of STATUS) a.status[key] += b.status[key];
    for (let i = 0; i < a.latency.length; i++) a.latency[i] += b.latency[i];
  }
}
function p95(hist: number[]) {
  const total = hist.reduce((sum, n) => sum + n, 0);
  if (!total) return null;
  const threshold = Math.ceil(total * 0.95);
  let sum = 0;
  for (let i = 0; i < hist.length; i++) {
    sum += hist[i];
    if (sum >= threshold) return LATENCY[i] ?? null;
  }
  return null;
}
export function createObservability({ now = Date.now, emit = (_report: unknown) => {} } = {}) {
  const startedAt = now(), windows: Window[] = [];
  let current: Window | undefined, skippedLogs = 0;
  function rotate() {
    const start = Math.floor(now() / WINDOW) * WINDOW;
    if (current && current.start !== start) {
      try {
        emit({ event: "public_safety.api_aggregate.v1", windowStart: new Date(current.start).toISOString(), windowEnd: new Date(current.start + WINDOW).toISOString(), skippedLogsBefore: skippedLogs, ...current.counts });
        skippedLogs = 0;
      } catch { skippedLogs++; }
      current = undefined;
    }
    while (windows.length && (windows[0].start < start - (RETENTION - 1) * WINDOW || windows.length >= RETENTION && !current)) windows.shift();
    return start;
  }
  function record(o: Observation) {
    const start = rotate();
    if (!current) { current = { start, counts: newCounts() }; windows.push(current); }
    const c = current.counts;
    if (c.requests >= MAX_REQUESTS) { c.dropped = Math.min(c.dropped + 1, Number.MAX_SAFE_INTEGER); return; }
    const route = c.routes[o.route];
    c.requests++; route.requests++;
    c.clients[o.client]++; c.probes[o.probe]++; c.auth[o.auth]++;
    route.status[statusKey(o.status)]++;
    const bucket = LATENCY.findIndex(ms => o.ms <= ms);
    route.latency[bucket < 0 ? LATENCY.length : bucket]++;
    const rows = Number.isSafeInteger(o.rows) && o.rows! >= 0 && o.rows! <= 10000 && o.status >= 200 && o.status < 300 ? o.rows! : 0;
    route.rows += rows;
    if (o.route === "export" && o.status === 200) { c.exportResponses++; c.exportRows += rows; }
  }
  function report() {
    rotate();
    const sum = newCounts();
    for (const w of windows) merge(sum, w.counts);
    const hist = Array<number>(LATENCY.length + 1).fill(0);
    for (const r of Object.values(sum.routes)) for (let i = 0; i < hist.length; i++) hist[i] += r.latency[i];
    return {
      enabled: true, scope: "api_handler_responses_only", asOf: new Date(now()).toISOString(), startedAt: new Date(startedAt).toISOString(),
      windowCount: windows.length, oldestWindow: windows.length ? new Date(windows[0].start).toISOString() : null,
      retentionHours: 24, skippedLogs, requests: sum.requests, dropped: sum.dropped, exportResponses: sum.exportResponses, exportRows: sum.exportRows,
      p95UpperMs: p95(hist), clients: sum.clients, probes: sum.probes, auth: sum.auth,
      routes: ROUTES.map(route => ({ route, ...sum.routes[route], p95UpperMs: p95(sum.routes[route].latency) })),
      windows: windows.map(w => ({ start: new Date(w.start).toISOString(), requests: w.counts.requests, exports: w.counts.exportResponses, denied: w.counts.auth.denied, dropped: w.counts.dropped })),
    };
  }
  return { record, report, rotate };
}
export type SecurityReport = ReturnType<ReturnType<typeof createObservability>["report"]>;
type Runtime = { tracker?: ReturnType<typeof createObservability>; maintenance: boolean };
const shared = globalThis as typeof globalThis & { __psdApiObservabilityV1?: Runtime };
function runtime() { return shared.__psdApiObservabilityV1 ??= { maintenance: false }; }
export function enabled() { return process.env.ENABLE_API_OBSERVABILITY === "true"; }
function tracker() {
  const state = runtime();
  if (!state.tracker) {
    const instance = createObservability({ emit: report => {
      if (process.stdout.writableNeedDrain || process.stdout.destroyed) throw Error("log sink busy");
      process.stdout.write(JSON.stringify(report) + "\n");
    } });
    state.tracker = instance;
    setInterval(() => { try { instance.rotate(); } catch { /* no impact on HTTP */ } }, 60000).unref();
  }
  return state.tracker;
}
export function securityReport() { return enabled() ? tracker().report() : { enabled: false as const }; }

type Context = { rows: (count: number) => void };
type Options = { admin?: boolean; maintenance?: boolean; report?: boolean };
export function observe(route: Route, handler: (request: Request, context: Context) => Response | Promise<Response>, options: Options = {}) {
  return async (request: Request): Promise<Response> => {
    const start = performance.now();
    let response: Response | undefined, auth: Observation["auth"] = "not_applicable", rows = 0, acquired = false;
    try {
      if (options.admin) {
        const denied = assertAdmin(request);
        if (denied) { auth = denied.status === 503 ? "unconfigured" : "denied"; response = denied; }
        else auth = "accepted";
      }
      if (!response && options.maintenance) {
        if (runtime().maintenance) response = jsonNoStore({ error: "Maintenance operation already running" }, { status: 429, headers: { "Retry-After": "10" } });
        else { runtime().maintenance = true; acquired = true; }
      }
      if (!response) response = await handler(request, { rows: count => { rows = count; } });
    } catch (error) {
      response = error instanceof ImportBodyTooLargeError ? jsonNoStore({ error: "Request body too large" }, { status: 413 })
        : error instanceof ImportBodyTimeoutError ? jsonNoStore({ error: "Request body timed out" }, { status: 408 })
        : error instanceof SyntaxError ? jsonNoStore({ error: "Invalid JSON request" }, { status: 400 })
        : jsonNoStore({ error: "Request failed" }, { status: 500 });
    } finally { if (acquired) runtime().maintenance = false; }
    // Report reads do not inflate counts. Failed authentication is still observed.
    if (enabled() && !(options.report && auth === "accepted")) {
      try {
        const probe = route === "unknown_api" ? classifyProbe(new URL(request.url).pathname) : "none";
        tracker().record({ route, status: response.status, ms: performance.now() - start, rows, client: classifyClient(request.headers.get("user-agent")), probe, auth });
        response.headers.set("x-request-id", randomUUID());
      } catch { /* observation must never change the response */ }
    }
    return response;
  };
}
