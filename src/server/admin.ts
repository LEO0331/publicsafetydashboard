import { createHash, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { jsonNoStore } from "./http";

const execFileAsync = promisify(execFile);

export function assertAdmin(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const actual = request.headers.get("x-admin-token") ?? "";
  if (!expected || expected === "change-me") {
    return jsonNoStore({ error: "Admin token is not configured" }, { status: 503 });
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!actual || actual.length > 4096 || !timingSafeEqual(digest(actual), digest(expected))) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function runPythonScript(args: string[]) {
  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: process.cwd(),
    timeout: 120_000,
  });
  return { stdout, stderr };
}
