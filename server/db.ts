import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import {
  ActivityLog,
  InsertActivityLog,
  InsertPortfolioHolding,
  InsertTrade,
  InsertUser,
  InsertUserSession,
  PortfolioHolding,
  Trade,
  User,
  UserSession,
  activityLogs,
  portfolioHoldings,
  trades,
  userSessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        const sslRaw = new URL(process.env.DATABASE_URL).searchParams.get("ssl");
        let sslConfig: any = undefined;
        if (sslRaw) {
          try {
            sslConfig = JSON.parse(sslRaw);
          } catch {
            sslConfig = { rejectUnauthorized: false };
          }
        } else if (process.env.DATABASE_URL.includes("amazonaws.com") || process.env.DATABASE_URL.includes("supabase") || process.env.DATABASE_URL.includes("neon")) {
          sslConfig = { rejectUnauthorized: false };
        }
        
        _pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: sslConfig,
          max: 10,
        });
      }
      _db = drizzle(_pool);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Database] Failed to connect:", message);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = [
    "name",
    "email",
    "loginMethod",
    "coinbaseAccessToken",
    "coinbaseRefreshToken",
    "coinbaseScopes",
    "stytchSessionToken",
    "lastJwt",
    "coinbaseUserId",
    "avatarUrl",
  ] as const;

  for (const field of textFields) {
    const value = user[field as keyof InsertUser];
    if (value !== undefined) {
      (values as Record<string, unknown>)[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  if (user.coinbaseTokenExpiresAt !== undefined) {
    values.coinbaseTokenExpiresAt = user.coinbaseTokenExpiresAt;
    updateSet.coinbaseTokenExpiresAt = user.coinbaseTokenExpiresAt;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ 
    target: users.openId, 
    set: updateSet 
  });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserJwt(userId: number, jwt: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastJwt: jwt, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function insertActivityLog(log: InsertActivityLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(log);
}

export async function getActivityLogsByUserId(userId: number): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(200);
}

export async function getAllActivityLogs(): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(500);
}

export async function insertTrade(trade: InsertTrade): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(trades).values(trade);
}

export async function getTradesByUserId(userId: number): Promise<Trade[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))
    .limit(100);
}

export async function getAllTrades(): Promise<Trade[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trades).orderBy(desc(trades.createdAt)).limit(500);
}

export async function getPortfolioByUserId(userId: number): Promise<PortfolioHolding[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioHoldings).where(eq(portfolioHoldings.userId, userId));
}

export async function upsertPortfolioHolding(
  userId: number,
  symbol: string,
  amount: string,
  avgBuyPrice: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(portfolioHoldings)
    .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.symbol, symbol)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(portfolioHoldings)
      .set({ amount, avgBuyPrice })
      .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.symbol, symbol)));
  } else {
    await db.insert(portfolioHoldings).values({ userId, symbol, amount, avgBuyPrice });
  }
}

export async function insertUserSession(session: InsertUserSession): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userSessions).values(session);
}

export async function getActiveSessionsByUserId(userId: number): Promise<UserSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.createdAt))
    .limit(50);
}

export async function getAllSessionsByUserId(userId: number): Promise<UserSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.createdAt))
    .limit(100);
}

export async function revokeUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
}

export async function getAllActiveSessions(): Promise<UserSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userSessions)
    .where(isNull(userSessions.revokedAt))
    .orderBy(desc(userSessions.createdAt))
    .limit(200);
}
