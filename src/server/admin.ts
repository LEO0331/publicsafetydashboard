import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function assertAdmin(request: NextRequest) {
  const expected = process.env.ADMIN_TOKEN;
  const actual = request.headers.get("x-admin-token") ?? "";
  if (!expected || expected === "change-me") {
    return Response.json({ error: "Admin token is not configured" }, { status: 503 });
  }
  if (!actual || actual !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
