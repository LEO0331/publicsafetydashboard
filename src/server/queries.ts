import { sqlite } from "./sqlite";

export type RecordFilters = {
  violationCount?: string | null;
  type?: string | null;
  location?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

function dateToMs(value?: string | null, endOfDay = false): number | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function parseViolationTypes(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function positiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function baseRecordWhere(filters: RecordFilters) {
  const where = ["r.is_hidden = 0", "s.is_hidden = 0"];
  const params: Record<string, unknown> = {};
  if (filters.violationCount) {
    const raw = filters.violationCount.replace("+", "");
    const count = Number(raw);
    if (!Number.isNaN(count)) {
      where.push(filters.violationCount.includes("+") ? "r.violation_count >= @violationCount" : "r.violation_count = @violationCount");
      params.violationCount = count;
    }
  }
  if (filters.type) {
    where.push("r.violation_types_json LIKE @type");
    params.type = `%${filters.type}%`;
  }
  if (filters.location) {
    where.push("r.location_text LIKE @location");
    params.location = `%${filters.location}%`;
  }
  const from = dateToMs(filters.dateFrom);
  const to = dateToMs(filters.dateTo, true);
  if (from) {
    where.push("r.violation_date >= @dateFrom");
    params.dateFrom = from;
  }
  if (to) {
    where.push("r.violation_date <= @dateTo");
    params.dateTo = to;
  }
  return { where: where.join(" AND "), params };
}

export function getRecords(filters: RecordFilters) {
  const page = positiveInt(filters.page, 1);
  const pageSize = Math.min(positiveInt(filters.pageSize, 25), 100);
  const { where, params } = baseRecordWhere(filters);
  const total = sqlite.prepare(`SELECT COUNT(*) AS count FROM offender_records r JOIN sources s ON s.id = r.source_id WHERE ${where}`).get(params) as { count: number };
  const rows = sqlite
    .prepare(
      `
      SELECT r.*, s.title AS source_title, s.pdf_url, s.published_date
      FROM offender_records r
      JOIN sources s ON s.id = r.source_id
      WHERE ${where}
      ORDER BY r.violation_date DESC, r.id DESC
      LIMIT @limit OFFSET @offset
      `
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
  return { rows, total: total.count, page, pageSize };
}

export function getExportRecords(filters: RecordFilters) {
  const { where, params } = baseRecordWhere(filters);
  return sqlite
    .prepare(
      `
      SELECT r.name, r.violation_date, r.violation_count, r.violation_types_json,
             r.location_text, r.alcohol_mg_per_l, s.title AS source_title, s.pdf_url
      FROM offender_records r
      JOIN sources s ON s.id = r.source_id
      WHERE ${where}
      ORDER BY r.violation_date DESC, r.id DESC
      `
    )
    .all(params);
}

export function getStats() {
  const visibleJoin = "FROM offender_records r JOIN sources s ON s.id = r.source_id WHERE r.is_hidden = 0 AND s.is_hidden = 0";
  const totalRecords = (sqlite.prepare(`SELECT COUNT(*) AS count ${visibleJoin}`).get() as { count: number }).count;
  const announcements = (sqlite.prepare("SELECT COUNT(*) AS count FROM sources WHERE is_hidden = 0").get() as { count: number }).count;
  const needsReview = (sqlite.prepare(`SELECT COUNT(*) AS count ${visibleJoin} AND r.needs_review = 1`).get() as { count: number }).count;
  const sourceFreshness = sqlite
    .prepare(
      `
      SELECT
        MAX(published_date) AS latestPublishedDate,
        MAX(downloaded_at) AS latestDownloadedAt
      FROM sources
      WHERE is_hidden = 0
      `
    )
    .get() as { latestPublishedDate: number | null; latestDownloadedAt: number | null };
  const recordFreshness = sqlite
    .prepare(
      `
      SELECT MAX(r.updated_at) AS latestRecordUpdatedAt
      ${visibleJoin}
      `
    )
    .get() as { latestRecordUpdatedAt: number | null };
  const byCount = sqlite
    .prepare(`SELECT r.violation_count AS value, COUNT(*) AS count ${visibleJoin} GROUP BY r.violation_count ORDER BY r.violation_count`)
    .all();
  const rows = sqlite.prepare(`SELECT r.violation_types_json ${visibleJoin}`).all() as { violation_types_json: string | null }[];
  const byType = new Map<string, number>();
  for (const row of rows) {
    for (const type of parseViolationTypes(row.violation_types_json)) {
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
  }
  const topLocations = sqlite
    .prepare(
      `SELECT r.location_text AS location, COUNT(*) AS count ${visibleJoin} AND r.location_text IS NOT NULL GROUP BY r.location_text ORDER BY count DESC LIMIT 10`
    )
    .all();
  return {
    totalRecords,
    announcements,
    needsReview,
    ...sourceFreshness,
    ...recordFreshness,
    byCount,
    byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
    topLocations,
  };
}

export function getReviewItems(limit = 25) {
  return sqlite
    .prepare(
      `
      SELECT r.id, r.sequence_no, r.name, r.violation_date, r.location_text,
             r.fact_text, r.parser_confidence, r.needs_review,
             s.title AS source_title, s.pdf_url
      FROM offender_records r
      JOIN sources s ON s.id = r.source_id
      WHERE r.is_hidden = 0 AND s.is_hidden = 0 AND r.needs_review = 1
      ORDER BY r.parser_confidence ASC, r.id DESC
      LIMIT @limit
      `
    )
    .all({ limit });
}

export function getAdminSources() {
  return sqlite
    .prepare(
      `
      SELECT s.id, s.title, s.pdf_url, s.published_date, s.parse_status, s.is_hidden,
             COUNT(r.id) AS record_count,
             SUM(CASE WHEN r.needs_review = 1 AND r.is_hidden = 0 THEN 1 ELSE 0 END) AS review_count
      FROM sources s
      LEFT JOIN offender_records r ON r.source_id = s.id
      GROUP BY s.id
      ORDER BY s.published_date DESC, s.id DESC
      LIMIT 50
      `
    )
    .all();
}

export function setSourceHidden(id: number, hidden: boolean) {
  const result = sqlite.prepare("UPDATE sources SET is_hidden = ?, updated_at = unixepoch() * 1000 WHERE id = ?").run(hidden ? 1 : 0, id);
  return result.changes;
}

export function setRecordHidden(id: number, hidden: boolean) {
  const result = sqlite.prepare("UPDATE offender_records SET is_hidden = ?, updated_at = unixepoch() * 1000 WHERE id = ?").run(hidden ? 1 : 0, id);
  return result.changes;
}

export function getLocations() {
  const rows = sqlite
    .prepare(
      `
      SELECT r.location_text, r.violation_types_json, r.violation_date, g.lat, g.lng
      FROM offender_records r
      JOIN sources s ON s.id = r.source_id
      LEFT JOIN geocoded_locations g ON g.location_text = r.location_text
      WHERE r.is_hidden = 0 AND s.is_hidden = 0 AND r.location_text IS NOT NULL AND r.location_text != ''
      `
    )
    .all() as { location_text: string; violation_types_json: string | null; violation_date: number | null; lat: number | null; lng: number | null }[];
  const grouped = new Map<string, { location: string; count: number; lat: number | null; lng: number | null; dateMin: number | null; dateMax: number | null; types: Map<string, number> }>();
  for (const row of rows) {
    const item = grouped.get(row.location_text) ?? {
      location: row.location_text,
      count: 0,
      lat: row.lat,
      lng: row.lng,
      dateMin: null,
      dateMax: null,
      types: new Map<string, number>(),
    };
    item.count += 1;
    if (row.violation_date) {
      item.dateMin = item.dateMin ? Math.min(item.dateMin, row.violation_date) : row.violation_date;
      item.dateMax = item.dateMax ? Math.max(item.dateMax, row.violation_date) : row.violation_date;
    }
    for (const type of parseViolationTypes(row.violation_types_json)) {
      item.types.set(type, (item.types.get(type) ?? 0) + 1);
    }
    grouped.set(row.location_text, item);
  }
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    types: Array.from(item.types.entries()).map(([type, count]) => ({ type, count })),
  }));
}
