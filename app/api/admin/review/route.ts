import { NextRequest } from "next/server";
import { assertAdmin } from "../../../../src/server/admin";
import { getAdminSources, getReviewItems } from "../../../../src/server/queries";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const unauthorized = assertAdmin(request);
  if (unauthorized) return unauthorized;
  return Response.json({
    reviewItems: getReviewItems(),
    sources: getAdminSources(),
  });
}
