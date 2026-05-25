CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionJwt` text NOT NULL,
	`stytchSessionToken` text,
	`coinbaseAccessTokenSnapshot` text,
	`ipAddress` varchar(64),
	`userAgent` text,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
