import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertAdmin } from "../../../../src/server/admin";
import { jsonNoStore } from "../../../../src/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  const logPath = path.join(process.cwd(), "logs", "import.log");
  const text = await readFile(logPath, "utf-8").catch(() => "");
  return jsonNoStore({ logs: text.split("\n").filter(Boolean).slice(-200) });
}
