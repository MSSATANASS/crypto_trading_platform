import {
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const sideEnum = pgEnum("side", ["buy", "sell"]);
export const statusEnum = pgEnum("status", ["filled", "pending", "cancelled"]);

/**
 * Core user table - extended with SnapTrade/Coinbase OAuth fields
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** User_id returned from OAuth callback */
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  /** Coinbase access token obtained via SnapTrade OAuth */
  coinbaseAccessToken: text("coinbaseAccessToken"),
  /** Coinbase refresh token */
  coinbaseRefreshToken: text("coinbaseRefreshToken"),
  /** Token expiry timestamp */
  coinbaseTokenExpiresAt: timestamp("coinbaseTokenExpiresAt", { mode: "date" }),
  /** Coinbase OAuth scopes granted */
  coinbaseScopes: text("coinbaseScopes"),
  /** Stytch session token (deprecated, keeping for compat) */
  stytchSessionToken: text("stytchSessionToken"),
  /** Last generated JWT for this user */
  lastJwt: text("lastJwt"),
  /** Coinbase user ID */
  coinbaseUserId: varchar("coinbaseUserId", { length: 128 }),
  /** Avatar URL from OAuth provider */
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Activity logs - every session, login event, and action per user
 */
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
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
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * Simulated trades - buy/sell operations per user
 */
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  /** Trading pair e.g. BTC-USD */
  pair: varchar("pair", { length: 20 }).notNull(),
  /** buy or sell */
  side: sideEnum("side").notNull(),
  /** Amount of crypto */
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  /** Price at execution */
  price: decimal("price", { precision: 18, scale: 2 }).notNull(),
  /** Total value in USD */
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  /** Status of the trade */
  status: statusEnum("status").default("filled").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * User portfolio - current holdings per user
 */
export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  /** Crypto symbol e.g. BTC */
  symbol: varchar("symbol", { length: 20 }).notNull(),
  /** Amount held */
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull().default("0"),
  /** Average buy price */
  avgBuyPrice: decimal("avgBuyPrice", { precision: 18, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = typeof portfolioHoldings.$inferInsert;

/**
 * User sessions - active session tracking with Stytch + JWT context
 */
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
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
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  /** When session was revoked (logout), null if active */
  revokedAt: timestamp("revokedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
