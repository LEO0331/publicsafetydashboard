import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    pdfUrl: text("pdf_url").notNull().unique(),
    publishedDate: integer("published_date", { mode: "timestamp_ms" }),
    downloadedAt: integer("downloaded_at", { mode: "timestamp_ms" }),
    contentHash: text("content_hash").unique(),
    parseStatus: text("parse_status").notNull().default("pending"),
    parseError: text("parse_error"),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
  },
  (t) => ({
    publishedDateIdx: index("sources_published_date_idx").on(t.publishedDate),
    parseStatusIdx: index("sources_parse_status_idx").on(t.parseStatus),
    hiddenPublishedDateIdx: index("sources_hidden_published_date_idx").on(t.isHidden, t.publishedDate),
    hiddenDownloadedAtIdx: index("sources_hidden_downloaded_at_idx").on(t.isHidden, t.downloadedAt)
  })
);

export const offenderRecords = sqliteTable(
  "offender_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    sequenceNo: text("sequence_no"),
    name: text("name"),
    violationDate: integer("violation_date", { mode: "timestamp_ms" }),
    lawArticle: text("law_article"),
    locationText: text("location_text"),
    factText: text("fact_text"),
    violationCount: integer("violation_count"),
    violationTypesJson: text("violation_types_json"),
    alcoholMgPerL: real("alcohol_mg_per_l"),
    unlicensed: integer("unlicensed", { mode: "boolean" }).notNull().default(false),
    hasPhoto: integer("has_photo", { mode: "boolean" }).notNull().default(false),
    parserConfidence: real("parser_confidence").notNull().default(0),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(true),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
  },
  (t) => ({
    sourceIdIdx: index("offender_records_source_id_idx").on(t.sourceId),
    violationDateIdx: index("offender_records_violation_date_idx").on(t.violationDate),
    violationCountIdx: index("offender_records_violation_count_idx").on(t.violationCount),
    needsReviewIdx: index("offender_records_needs_review_idx").on(t.needsReview),
    locationTextIdx: index("offender_records_location_text_idx").on(t.locationText),
    hiddenDateIdx: index("offender_records_hidden_date_idx").on(t.isHidden, t.violationDate),
    hiddenCountIdx: index("offender_records_hidden_count_idx").on(t.isHidden, t.violationCount),
    hiddenLocationIdx: index("offender_records_hidden_location_idx").on(t.isHidden, t.locationText),
    hiddenReviewIdx: index("offender_records_hidden_review_idx").on(t.isHidden, t.needsReview, t.parserConfidence)
  })
);

export const geocodedLocations = sqliteTable(
  "geocoded_locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    locationText: text("location_text").notNull(),
    normalizedQuery: text("normalized_query").notNull().unique(),
    lat: real("lat"),
    lng: real("lng"),
    geocodeProvider: text("geocode_provider").notNull().default("nominatim"),
    confidence: real("confidence"),
    geocodedAt: integer("geocoded_at", { mode: "timestamp_ms" }),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
  },
  (t) => ({
    locationTextIdx: index("geocoded_locations_location_text_idx").on(t.locationText),
    latLngIdx: index("geocoded_locations_lat_lng_idx").on(t.lat, t.lng)
  })
);
