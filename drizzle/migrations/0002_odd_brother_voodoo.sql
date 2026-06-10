CREATE INDEX `offender_records_hidden_date_idx` ON `offender_records` (`is_hidden`,`violation_date`);--> statement-breakpoint
CREATE INDEX `offender_records_hidden_count_idx` ON `offender_records` (`is_hidden`,`violation_count`);--> statement-breakpoint
CREATE INDEX `offender_records_hidden_location_idx` ON `offender_records` (`is_hidden`,`location_text`);--> statement-breakpoint
CREATE INDEX `offender_records_hidden_review_idx` ON `offender_records` (`is_hidden`,`needs_review`,`parser_confidence`);--> statement-breakpoint
CREATE INDEX `sources_hidden_published_date_idx` ON `sources` (`is_hidden`,`published_date`);--> statement-breakpoint
CREATE INDEX `sources_hidden_downloaded_at_idx` ON `sources` (`is_hidden`,`downloaded_at`);