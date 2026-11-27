import { observe } from "../../../../src/server/observability";
import { jsonNoStore } from "../../../../src/server/http";
import { getAdminSources, getReviewItems } from "../../../../src/server/queries";

export const runtime = "nodejs";

export const GET = observe("admin_review", async () => {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  return jsonNoStore({
    reviewItems: getReviewItems(),
    sources: getAdminSources(),
  });
}, { admin: true });
