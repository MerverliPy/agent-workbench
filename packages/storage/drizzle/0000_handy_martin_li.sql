CREATE TABLE `cache_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`project_path` text NOT NULL,
	`cache_type` text NOT NULL,
	`cache_key` text NOT NULL,
	`value_json` text NOT NULL,
	`source_hash` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`invalidated_at` text,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `cache_entries_session_id_idx` ON `cache_entries` (`session_id`);--> statement-breakpoint
CREATE INDEX `cache_entries_cache_type_idx` ON `cache_entries` (`cache_type`);--> statement-breakpoint
CREATE INDEX `cache_entries_cache_key_idx` ON `cache_entries` (`cache_key`);--> statement-breakpoint
CREATE INDEX `cache_entries_expires_at_idx` ON `cache_entries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `config_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`config_hash` text NOT NULL,
	`effective_config_json` text NOT NULL,
	`redacted_config_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_snapshots_session_id_idx` ON `config_snapshots` (`session_id`);--> statement-breakpoint
CREATE INDEX `config_snapshots_run_id_idx` ON `config_snapshots` (`run_id`);--> statement-breakpoint
CREATE TABLE `file_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`tool_call_id` text,
	`path` text NOT NULL,
	`change_type` text NOT NULL,
	`before_hash` text,
	`after_hash` text,
	`patch` text,
	`dry_run_id` text,
	`approved_by_permission_decision_id` text,
	`created_at` text NOT NULL,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `file_changes_session_id_idx` ON `file_changes` (`session_id`);--> statement-breakpoint
CREATE INDEX `file_changes_run_id_idx` ON `file_changes` (`run_id`);--> statement-breakpoint
CREATE INDEX `file_changes_path_idx` ON `file_changes` (`path`);--> statement-breakpoint
CREATE INDEX `file_changes_change_type_idx` ON `file_changes` (`change_type`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`content_format` text DEFAULT 'text' NOT NULL,
	`parent_message_id` text,
	`created_at` text NOT NULL,
	`metadata_json` text,
	`token_count` integer
);
--> statement-breakpoint
CREATE INDEX `messages_session_id_idx` ON `messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `messages_run_id_idx` ON `messages` (`run_id`);--> statement-breakpoint
CREATE INDEX `messages_role_idx` ON `messages` (`role`);--> statement-breakpoint
CREATE TABLE `permission_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`decision` text NOT NULL,
	`decided_by` text,
	`scope` text,
	`reason` text,
	`created_at` text NOT NULL,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `permission_decisions_request_id_idx` ON `permission_decisions` (`request_id`);--> statement-breakpoint
CREATE TABLE `permission_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`run_id` text,
	`tool_call_id` text,
	`agent_id` text,
	`tool_name` text NOT NULL,
	`risk_level` text NOT NULL,
	`reason` text,
	`target_paths_json` text,
	`command` text,
	`diff_summary_json` text,
	`dry_run_summary_json` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `permission_requests_session_id_idx` ON `permission_requests` (`session_id`);--> statement-breakpoint
CREATE INDEX `permission_requests_run_id_idx` ON `permission_requests` (`run_id`);--> statement-breakpoint
CREATE INDEX `permission_requests_tool_call_id_idx` ON `permission_requests` (`tool_call_id`);--> statement-breakpoint
CREATE INDEX `permission_requests_status_idx` ON `permission_requests` (`status`);--> statement-breakpoint
CREATE TABLE `run_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`event_type` text NOT NULL,
	`event_category` text NOT NULL,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text,
	`redaction_status` text DEFAULT 'none' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `run_ledger_session_id_idx` ON `run_ledger` (`session_id`);--> statement-breakpoint
CREATE INDEX `run_ledger_run_id_idx` ON `run_ledger` (`run_id`);--> statement-breakpoint
CREATE INDEX `run_ledger_event_category_idx` ON `run_ledger` (`event_category`);--> statement-breakpoint
CREATE INDEX `run_ledger_event_type_idx` ON `run_ledger` (`event_type`);--> statement-breakpoint
CREATE INDEX `run_ledger_created_at_idx` ON `run_ledger` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_path` text NOT NULL,
	`title` text,
	`active_agent` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_run_at` text,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`summary_type` text NOT NULL,
	`source_range_json` text,
	`content` text NOT NULL,
	`quality_status` text DEFAULT 'unchecked' NOT NULL,
	`created_at` text NOT NULL,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `summaries_session_id_idx` ON `summaries` (`session_id`);--> statement-breakpoint
CREATE INDEX `summaries_run_id_idx` ON `summaries` (`run_id`);--> statement-breakpoint
CREATE INDEX `summaries_summary_type_idx` ON `summaries` (`summary_type`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`run_id` text,
	`message_id` text,
	`tool_name` text NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text,
	`error_json` text,
	`started_at` text,
	`completed_at` text,
	`metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `tool_calls_session_id_idx` ON `tool_calls` (`session_id`);--> statement-breakpoint
CREATE INDEX `tool_calls_run_id_idx` ON `tool_calls` (`run_id`);--> statement-breakpoint
CREATE INDEX `tool_calls_message_id_idx` ON `tool_calls` (`message_id`);--> statement-breakpoint
CREATE INDEX `tool_calls_status_idx` ON `tool_calls` (`status`);