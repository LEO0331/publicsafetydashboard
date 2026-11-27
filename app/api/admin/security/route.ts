import { observe, securityReport } from "../../../../src/server/observability";
import { jsonNoStore } from "../../../../src/server/http";

export const runtime = "nodejs";
export const GET = observe("security_report", () => jsonNoStore(securityReport()), { admin: true, report: true });
