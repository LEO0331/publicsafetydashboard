import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "drizzle", "e2e.db");
rmSync(dbPath, { force: true });
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
  db.exec(readFileSync(path.join(migrationsDir, file), "utf-8"));
}

const date = (value) => new Date(`${value}T00:00:00Z`).getTime();

const sourceA = db
  .prepare("INSERT INTO sources (title, source_url, pdf_url, published_date, parse_status) VALUES (?, ?, ?, ?, ?) RETURNING id")
  .get("115.05.23 臺北市酒駕累犯公告", "https://example.test/source-a", "https://example.test/a.pdf", date("2026-05-23"), "parsed");
const sourceB = db
  .prepare("INSERT INTO sources (title, source_url, pdf_url, published_date, parse_status) VALUES (?, ?, ?, ?, ?) RETURNING id")
  .get("115.05.24 臺北市拒測累犯公告", "https://example.test/source-b", "https://example.test/b.pdf", date("2026-05-24"), "parsed");

const insertRecord = db.prepare(`
  INSERT INTO offender_records
    (source_id, sequence_no, name, violation_date, law_article, location_text, fact_text,
     violation_count, violation_types_json, alcohol_mg_per_l, unlicensed, has_photo,
     parser_confidence, needs_review)
  VALUES
    (@sourceId, @sequenceNo, @name, @violationDate, @lawArticle, @locationText, @factText,
     @violationCount, @violationTypesJson, @alcoholMgPerL, @unlicensed, 0, 1, 0)
`);

insertRecord.run({
  sourceId: sourceA.id,
  sequenceNo: "1",
  name: "王小明",
  violationDate: date("2026-05-23"),
  lawArticle: "道路交通管理處罰條例",
  locationText: "忠孝東路一段",
  factText: "酒駕第2次，酒精濃度0.20mg/L",
  violationCount: 2,
  violationTypesJson: '["酒駕"]',
  alcoholMgPerL: 0.2,
  unlicensed: 0,
});

insertRecord.run({
  sourceId: sourceA.id,
  sequenceNo: "2",
  name: "陳小安",
  violationDate: date("2026-05-24"),
  lawArticle: "道路交通管理處罰條例",
  locationText: "忠孝東路一段",
  factText: "酒駕第4次且無照",
  violationCount: 4,
  violationTypesJson: '["酒駕","無照"]',
  alcoholMgPerL: null,
  unlicensed: 1,
});

insertRecord.run({
  sourceId: sourceB.id,
  sequenceNo: "3",
  name: "李小美",
  violationDate: date("2026-05-25"),
  lawArticle: "道路交通管理處罰條例",
  locationText: "南京東路三段",
  factText: "拒測第3次以上",
  violationCount: 3,
  violationTypesJson: '["拒測"]',
  alcoholMgPerL: null,
  unlicensed: 0,
});

db.prepare(
  "INSERT INTO geocoded_locations (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at) VALUES (?, ?, ?, ?, 'fixture', ?, ?)"
).run("忠孝東路一段", "臺北市 忠孝東路一段", 25.044, 121.523, 1, Date.now());
db.prepare(
  "INSERT INTO geocoded_locations (location_text, normalized_query, lat, lng, geocode_provider, confidence, geocoded_at) VALUES (?, ?, ?, ?, 'fixture', ?, ?)"
).run("南京東路三段", "臺北市 南京東路三段", 25.052, 121.545, 1, Date.now());

db.close();
console.log(`Seeded e2e database at ${dbPath}`);
