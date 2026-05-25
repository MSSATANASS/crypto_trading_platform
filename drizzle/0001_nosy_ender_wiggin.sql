CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`description` text,
	`ipAddress` varchar(64),
	`userAgent` text,
	`jwtSnapshot` text,
	`coinbaseTokenSnapshot` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`amount` decimal(18,8) NOT NULL DEFAULT '0',
	`avgBuyPrice` decimal(18,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pair` varchar(20) NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`amount` decimal(18,8) NOT NULL,
	`price` decimal(18,2) NOT NULL,
	`total` decimal(18,2) NOT NULL,
	`status` enum('filled','pending','cancelled') NOT NULL DEFAULT 'filled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `coinbaseAccessToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `coinbaseRefreshToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `coinbaseTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `coinbaseScopes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stytchSessionToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `lastJwt` text;--> statement-breakpoint
ALTER TABLE `users` ADD `coinbaseUserId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;