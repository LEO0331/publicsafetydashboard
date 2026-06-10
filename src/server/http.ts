export function noStoreHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set("cache-control", "no-store");
  return headers;
}

export function jsonNoStore(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

export function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
