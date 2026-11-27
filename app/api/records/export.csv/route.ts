import { observe } from "../../../../src/server/observability";
import { getExportRecords } from "../../../../src/server/queries";
import { noStoreHeaders, jsonNoStore } from "../../../../src/server/http";

import { buildCsv } from "../../../../src/server/csv-export";

export const runtime = "nodejs";

export const GET = observe("export", async (request, context) => {
  const params = new URL(request.url).searchParams;
  const rows = getExportRecords({
    violationCount: params.get("violationCount"),
    type: params.get("type"),
    location: params.get("location"),
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
  });
  const body = buildCsv(rows);
  if (body === null) return jsonNoStore({ error: "Export exceeds 10,000 rows or 8 MiB; narrow filters" }, { status: 413 });
  context.rows(rows.length);

  return new Response(body, {
    headers: noStoreHeaders({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="taipei-public-safety-records.csv"',
    }),
  });
});
