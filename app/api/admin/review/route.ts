import { NextRequest } from "next/server";
import { assertAdmin } from "../../../../src/server/admin";
import { jsonNoStore } from "../../../../src/server/http";
import { getAdminSources, getReviewItems } from "../../../../src/server/queries";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  return jsonNoStore({
    reviewItems: getReviewItems(),
    sources: getAdminSources(),
  });
}
