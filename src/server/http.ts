import { readBoundedImportBody } from "./announcement-import";

export function noStoreHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function jsonNoStore(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await (await readBoundedImportBody(request, 16 * 1024)).json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SyntaxError("Invalid JSON object");
  return body as Record<string, unknown>;
}

export function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
