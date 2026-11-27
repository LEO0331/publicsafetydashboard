import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { jsonNoStore } from "./http";
import { adminSessions, assertAdminMutation, sessionIdentifier } from "./admin-session";
import { recordAuthentication } from "./observability";

const execFileAsync = promisify(execFile);

export function assertAdmin(request: Request) {
  if (!adminSessions().configured()) {
    return jsonNoStore({ error: "Admin token is not configured" }, { status: 503 });
  }
  const identifier = sessionIdentifier(request);
  if (!adminSessions().lookup(identifier, false)) {
    recordAuthentication("auth_session_invalid", 401);
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = assertAdminMutation(request);
  if (forbidden) return forbidden;
  adminSessions().lookup(identifier);
  return null;
}

export async function runPythonScript(args: string[]) {
  const { stdout, stderr } = await execFileAsync("python3", args, {
    cwd: process.cwd(),
    timeout: 120_000,
  });
  return { stdout, stderr };
}
