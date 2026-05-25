import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table - extended with Stytch/Coinbase OAuth fields
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Stytch user_id returned from OAuth callback */
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Coinbase access token obtained via Stytch OAuth */
  coinbaseAccessToken: text("coinbaseAccessToken"),
  /** Coinbase refresh token */
  coinbaseRefreshToken: text("coinbaseRefreshToken"),
  /** Token expiry timestamp */
  coinbaseTokenExpiresAt: timestamp("coinbaseTokenExpiresAt"),
  /** Coinbase OAuth scopes granted */
  coinbaseScopes: text("coinbaseScopes"),
  /** Stytch session token */
  stytchSessionToken: text("stytchSessionToken"),
  /** Last generated JWT for this user */
  lastJwt: text("lastJwt"),
  /** Coinbase user ID */
  coinbaseUserId: varchar("coinbaseUserId", { length: 128 }),
  /** Avatar URL from OAuth provider */
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Activity logs - every session, login event, and action per user
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Type of event: login, logout, trade, page_view, token_refresh */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  /** Human-readable description */
  description: text("description"),
  /** IP address of the client */
  ipAddress: varchar("ipAddress", { length: 64 }),
  /** User-Agent string */
  userAgent: text("userAgent"),
  /** JWT issued at this event */
  jwtSnapshot: text("jwtSnapshot"),
  /** Coinbase access token snapshot at this event */
  coinbaseTokenSnapshot: text("coinbaseTokenSnapshot"),
  /** Additional metadata as JSON */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * Simulated trades - buy/sell operations per user
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Trading pair e.g. BTC-USD */
  pair: varchar("pair", { length: 20 }).notNull(),
  /** buy or sell */
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  /** Amount of crypto */
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  /** Price at execution */
  price: decimal("price", { precision: 18, scale: 2 }).notNull(),
  /** Total value in USD */
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  /** Status of the trade */
  status: mysqlEnum("status", ["filled", "pending", "cancelled"]).default("filled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * User portfolio - current holdings per user
 */
export const portfolioHoldings = mysqlTable("portfolio_holdings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Crypto symbol e.g. BTC */
  symbol: varchar("symbol", { length: 20 }).notNull(),
  /** Amount held */
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull().default("0"),
  /** Average buy price */
  avgBuyPrice: decimal("avgBuyPrice", { precision: 18, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = typeof portfolioHoldings.$inferInsert;

/**
 * User sessions - active session tracking with Stytch + JWT context
 */
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Hashed session JWT used as session identifier */
  sessionJwt: text("sessionJwt").notNull(),
  /** Stytch session token if available */
  stytchSessionToken: text("stytchSessionToken"),
  /** Coinbase access token captured at session creation */
  coinbaseAccessTokenSnapshot: text("coinbaseAccessTokenSnapshot"),
  /** IP address that created the session */
  ipAddress: varchar("ipAddress", { length: 64 }),
  /** User-Agent header */
  userAgent: text("userAgent"),
  /** Session expiration timestamp */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When session was revoked (logout), null if active */
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
