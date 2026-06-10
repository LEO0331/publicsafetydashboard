import { getRecords } from "../../../src/server/queries";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return jsonNoStore(
    getRecords({
      violationCount: params.get("violationCount"),
      type: params.get("type"),
      location: params.get("location"),
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    })
  );
}
