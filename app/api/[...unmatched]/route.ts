import { observe } from "../../../src/server/observability";
import { jsonNoStore } from "../../../src/server/http";

export const runtime = "nodejs";
const notFound = observe("unknown_api", () => jsonNoStore({ error: "Not found" }, { status: 404 }));
export { notFound as GET, notFound as HEAD, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as OPTIONS };
