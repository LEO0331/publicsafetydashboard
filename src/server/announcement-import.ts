export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const officialAuthorities = new Set([
  "dot.gov.taipei",
  "dot.gov.taipei:443",
  "www-ws.gov.taipei",
  "www-ws.gov.taipei:443",
]);

export function isOfficialAnnouncementUrl(value: string) {
  if (/\s/.test(value) || value.includes("\\") || value.includes("#")) return false;
  if (Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return false;
  const authority = /^https:\/\/([^/?]+)/i.exec(value)?.[1]?.toLowerCase();
  return authority !== undefined && officialAuthorities.has(authority);
}

export class ImportBodyTooLargeError extends Error {}
export class ImportBodyTimeoutError extends Error {}

export async function readBoundedImportBody(request: Request, maxBytes: number, timeoutMs = 30000) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ImportBodyTooLargeError();

  const contentType = request.headers.get("content-type");
  const headers = contentType ? { "content-type": contentType } : undefined;
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { headers });

  const chunks: Uint8Array[] = [];
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  let bytesRead = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) throw new ImportBodyTimeoutError();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ImportBodyTooLargeError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
  const body = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, { headers });
}
