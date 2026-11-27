import { observe } from "../../../src/server/observability";
import { getRecords } from "../../../src/server/queries";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";

export const GET = observe("records", async (request, context) => {
  const params = new URL(request.url).searchParams;
  const result = getRecords({
      violationCount: params.get("violationCount"),
      type: params.get("type"),
      location: params.get("location"),
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });
  context.rows(result.rows.length);
  return jsonNoStore(result);
});
