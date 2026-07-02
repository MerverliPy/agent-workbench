CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`description` text,
	`archived` integer DEFAULT false,
	`tags_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspaces_archived_idx` ON `workspaces` (`archived`);--> statement-breakpoint
CREATE INDEX `workspaces_name_idx` ON `workspaces` (`name`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `workspace_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `tags_json` text;--> statement-breakpoint
CREATE INDEX `sessions_workspace_idx` ON `sessions` (`workspace_id`);