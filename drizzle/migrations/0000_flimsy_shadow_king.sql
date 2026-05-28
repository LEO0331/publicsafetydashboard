CREATE TABLE `geocoded_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_text` text NOT NULL,
	`normalized_query` text NOT NULL,
	`lat` real,
	`lng` real,
	`geocode_provider` text DEFAULT 'nominatim' NOT NULL,
	`confidence` real,
	`geocoded_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `geocoded_locations_normalized_query_unique` ON `geocoded_locations` (`normalized_query`);--> statement-breakpoint
CREATE INDEX `geocoded_locations_location_text_idx` ON `geocoded_locations` (`location_text`);--> statement-breakpoint
CREATE INDEX `geocoded_locations_lat_lng_idx` ON `geocoded_locations` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `offender_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`sequence_no` text,
	`name` text,
	`violation_date` integer,
	`law_article` text,
	`location_text` text,
	`fact_text` text,
	`violation_count` integer,
	`violation_types_json` text,
	`alcohol_mg_per_l` real,
	`unlicensed` integer DEFAULT false NOT NULL,
	`has_photo` integer DEFAULT false NOT NULL,
	`parser_confidence` real DEFAULT 0 NOT NULL,
	`needs_review` integer DEFAULT true NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offender_records_source_id_idx` ON `offender_records` (`source_id`);--> statement-breakpoint
CREATE INDEX `offender_records_violation_date_idx` ON `offender_records` (`violation_date`);--> statement-breakpoint
CREATE INDEX `offender_records_violation_count_idx` ON `offender_records` (`violation_count`);--> statement-breakpoint
CREATE INDEX `offender_records_needs_review_idx` ON `offender_records` (`needs_review`);--> statement-breakpoint
CREATE INDEX `offender_records_location_text_idx` ON `offender_records` (`location_text`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`source_url` text NOT NULL,
	`pdf_url` text NOT NULL,
	`published_date` integer,
	`downloaded_at` integer,
	`content_hash` text,
	`parse_status` text DEFAULT 'pending' NOT NULL,
	`parse_error` text,
	`is_hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_source_url_unique` ON `sources` (`source_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_pdf_url_unique` ON `sources` (`pdf_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_content_hash_unique` ON `sources` (`content_hash`);--> statement-breakpoint
CREATE INDEX `sources_published_date_idx` ON `sources` (`published_date`);--> statement-breakpoint
CREATE INDEX `sources_parse_status_idx` ON `sources` (`parse_status`);