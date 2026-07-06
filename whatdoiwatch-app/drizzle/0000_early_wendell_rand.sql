CREATE TABLE `api_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `similar_titles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`src_type` text NOT NULL,
	`src_id` integer NOT NULL,
	`dst_type` text NOT NULL,
	`dst_id` integer NOT NULL,
	`score` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `similar_titles_src_idx` ON `similar_titles` (`src_type`,`src_id`);--> statement-breakpoint
CREATE TABLE `titles` (
	`media_type` text NOT NULL,
	`id` integer NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`genres` text NOT NULL,
	`vote_average` real,
	`poster_path` text,
	`overview` text,
	PRIMARY KEY(`media_type`, `id`)
);
