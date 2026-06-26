CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`summary` text NOT NULL,
	`risk_level` text DEFAULT 'high' NOT NULL,
	`steps_json` text NOT NULL,
	`target_files_json` text NOT NULL,
	`permission_request_id` text,
	`approval_policy` text,
	`created_at` text NOT NULL,
	`approved_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `plans_session_id_idx` ON `plans` (`session_id`);--> statement-breakpoint
CREATE INDEX `plans_run_id_idx` ON `plans` (`run_id`);--> statement-breakpoint
CREATE INDEX `plans_status_idx` ON `plans` (`status`);--> statement-breakpoint
CREATE INDEX `plans_created_at_idx` ON `plans` (`created_at`);