import { observe } from "../../../../src/server/observability";
import { jsonNoStore } from "../../../../src/server/http";
import { getAdminSources, getReviewCount, getReviewItems } from "../../../../src/server/queries";

export const runtime = "nodejs";

export const GET = observe("admin_review", async () => {
  return jsonNoStore({
    reviewItems: getReviewItems(),
    reviewCount: getReviewCount(),
    sources: getAdminSources(),
  });
}, { admin: true });
