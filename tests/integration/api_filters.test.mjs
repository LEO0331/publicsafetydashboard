import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

test("records query filters by violation count, type, location, and date", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "psd-api-"));
  const dbPath = path.join(dir, "test.db");
  process.env.SQLITE_PATH = dbPath;
  const db = new Database(dbPath);
  const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(path.join(migrationsDir, file), "utf-8"));
  }
  const violationDate = new Date("2026-05-23T00:00:00Z").getTime();
  const source = db
    .prepare("INSERT INTO sources (title, source_url, pdf_url, parse_status) VALUES (?, ?, ?, ?) RETURNING id")
    .get("公告", "https://example.test/page", "https://example.test/a.pdf", "parsed");
  db.prepare(
    `
    INSERT INTO offender_records
      (source_id, sequence_no, name, violation_date, location_text, fact_text, violation_count, violation_types_json, parser_confidence, needs_review)
    VALUES (?, '1', '王小明', ?, '忠孝東路一段', '酒駕第2次', 2, '["酒駕"]', 1, 0)
    `
  ).run(source.id, violationDate);
  db.prepare(
    `
    INSERT INTO offender_records
      (source_id, sequence_no, name, violation_date, location_text, fact_text, violation_count, violation_types_json, parser_confidence, needs_review)
    VALUES (?, '2', '李小美', ?, '南京東路三段', '拒測第3次以上', 3, '["拒測"]', 1, 0)
    `
  ).run(source.id, violationDate);
  const secondSource = db
    .prepare("INSERT INTO sources (title, source_url, pdf_url, parse_status) VALUES (?, ?, ?, ?) RETURNING id")
    .get("同頁第二份公告", "https://example.test/page", "https://example.test/second.pdf", "parsed");
  db.prepare(
    `
    INSERT INTO offender_records
      (source_id, sequence_no, name, violation_date, location_text, fact_text, violation_count, violation_types_json, parser_confidence, needs_review)
    VALUES (?, '3', '周小平', ?, '仁愛路一段', '酒駕第2次', 2, '["酒駕"]', 1, 0)
    `
  ).run(secondSource.id, violationDate);
  const hiddenSource = db
    .prepare("INSERT INTO sources (title, source_url, pdf_url, parse_status, is_hidden) VALUES (?, ?, ?, ?, 1) RETURNING id")
    .get("已移除公告", "https://example.test/removed", "https://example.test/removed.pdf", "parsed");
  db.prepare(
    `
    INSERT INTO offender_records
      (source_id, sequence_no, name, violation_date, location_text, fact_text, violation_count, violation_types_json, parser_confidence, needs_review)
    VALUES (?, '4', '不應顯示', ?, '隱藏路段', '拒測第5次', 5, '["拒測"]', 1, 0)
    `
  ).run(hiddenSource.id, violationDate);
  db.close();

  const { getLocations, getRecords, getStats } = await import("../../.tmp-test/queries.js");
  const filtered = getRecords({
    violationCount: "2",
    type: "酒駕",
    location: "忠孝",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
    page: "1",
    pageSize: "10",
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.rows[0].location_text, "忠孝東路一段");

  const stats = getStats();
  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.announcements, 2);
  assert.equal(stats.topLocations.some((item) => item.location === "隱藏路段"), false);

  const locations = getLocations();
  assert.equal(locations.some((item) => item.location === "隱藏路段"), false);
});
