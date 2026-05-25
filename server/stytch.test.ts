import { describe, expect, it, vi, beforeEach } from "vitest";

// Shared stateful mocks
const mockState: {
  user: any | null;
  insertedSessions: any[];
  insertedLogs: any[];
  insertedTrades: any[];
  jwtUpdates: { userId: number; jwt: string }[];
  notifications: { title: string; content: string }[];
  shouldFailStytch: boolean;
} = {
  user: null,
  insertedSessions: [],
  insertedLogs: [],
  insertedTrades: [],
  jwtUpdates: [],
  notifications: [],
  shouldFailStytch: false,
};

vi.mock("./stytch", () => ({
  authenticateStytchOAuthToken: vi.fn(async () => {
    if (mockState.shouldFailStytch) {
      throw new Error("Invalid token - expected in unit test");
    }
    return {
      userId: "stytch-user-123",
      email: "newuser@example.com",
      name: "Nuevo Usuario",
      avatarUrl: "https://example.com/avatar.png",
      sessionToken: "stytch-session-token-abc",
      coinbaseTokens: {
        accessToken: "coinbase-access-token-xyz",
        refreshToken: "coinbase-refresh-token-abc",
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: "wallet:user:read,wallet:accounts:read",
        coinbaseUserId: "cb-user-456",
      },
    };
  }),
}));

vi.mock("./db", () => ({
  upsertUser: vi.fn(async (u: any) => {
    if (!mockState.user) {
      mockState.user = {
        id: 42,
        openId: u.openId,
        name: u.name ?? null,
        email: u.email ?? null,
        loginMethod: u.loginMethod ?? null,
        role: "user",
        coinbaseAccessToken: u.coinbaseAccessToken ?? null,
        coinbaseRefreshToken: u.coinbaseRefreshToken ?? null,
        coinbaseTokenExpiresAt: u.coinbaseTokenExpiresAt ?? null,
        coinbaseScopes: u.coinbaseScopes ?? null,
        stytchSessionToken: u.stytchSessionToken ?? null,
        lastJwt: null,
        coinbaseUserId: u.coinbaseUserId ?? null,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
    } else {
      mockState.user = { ...mockState.user, ...u };
    }
  }),
  getUserByOpenId: vi.fn(async () => mockState.user),
  getUserById: vi.fn(async (id: number) =>
    mockState.user?.id === id ? mockState.user : null
  ),
  updateUserJwt: vi.fn(async (userId: number, jwt: string) => {
    mockState.jwtUpdates.push({ userId, jwt });
    if (mockState.user) mockState.user.lastJwt = jwt;
  }),
  insertActivityLog: vi.fn(async (log: any) => {
    mockState.insertedLogs.push(log);
  }),
  insertUserSession: vi.fn(async (s: any) => {
    mockState.insertedSessions.push(s);
  }),
  revokeUserSessions: vi.fn(async () => undefined),
  getActiveSessionsByUserId: vi.fn(async () => []),
  getAllSessionsByUserId: vi.fn(async () => mockState.insertedSessions),
  getAllActiveSessions: vi.fn(async () => mockState.insertedSessions),
  getAllUsers: vi.fn(async () => (mockState.user ? [mockState.user] : [])),
  getAllActivityLogs: vi.fn(async () => mockState.insertedLogs),
  getAllTrades: vi.fn(async () => mockState.insertedTrades),
  getTradesByUserId: vi.fn(async () => mockState.insertedTrades),
  getPortfolioByUserId: vi.fn(async () => []),
  insertTrade: vi.fn(async (t: any) => {
    mockState.insertedTrades.push(t);
  }),
  upsertPortfolioHolding: vi.fn(async () => undefined),
  getActivityLogsByUserId: vi.fn(async () => mockState.insertedLogs),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async (n: { title: string; content: string }) => {
    mockState.notifications.push(n);
    return true;
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function resetMockState() {
  mockState.user = null;
  mockState.insertedSessions = [];
  mockState.insertedLogs = [];
  mockState.insertedTrades = [];
  mockState.jwtUpdates = [];
  mockState.notifications = [];
  mockState.shouldFailStytch = false;
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "203.0.113.42" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthedContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "stytch-user-123",
      email: role === "admin" ? "admin@example.com" : "user@example.com",
      name: role === "admin" ? "Admin User" : "Trader User",
      loginMethod: "coinbase_oauth",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      coinbaseAccessToken: "coinbase-access-token-xyz",
      coinbaseRefreshToken: null,
      coinbaseTokenExpiresAt: null,
      coinbaseScopes: null,
      stytchSessionToken: null,
      lastJwt: null,
      coinbaseUserId: "cb-user-456",
      avatarUrl: null,
    },
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  resetMockState();
});

describe("auth.stytchCallback - success flow", () => {
  it("creates new user, generates JWT, records session, logs activity, and notifies owner", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.stytchCallback({
      token: "valid-stytch-oauth-token",
      tokenType: "oauth",
      origin: "https://example.com",
    });

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(result.user.name).toBe("Nuevo Usuario");
    expect(result.user.email).toBe("newuser@example.com");
    expect(result.jwt).toMatch(/^eyJ/); // JWT format

    // Session record was inserted with Coinbase token snapshot
    expect(mockState.insertedSessions).toHaveLength(1);
    expect(mockState.insertedSessions[0].coinbaseAccessTokenSnapshot).toBe(
      "coinbase-access-token-xyz"
    );
    expect(mockState.insertedSessions[0].stytchSessionToken).toBe(
      "stytch-session-token-abc"
    );

    // Activity log records register event with JWT and Coinbase token
    expect(mockState.insertedLogs).toHaveLength(1);
    expect(mockState.insertedLogs[0].eventType).toBe("register");
    expect(mockState.insertedLogs[0].jwtSnapshot).toBe(result.jwt);
    expect(mockState.insertedLogs[0].coinbaseTokenSnapshot).toBe(
      "coinbase-access-token-xyz"
    );

    // JWT was persisted to user
    expect(mockState.jwtUpdates).toHaveLength(1);
    expect(mockState.jwtUpdates[0].jwt).toBe(result.jwt);

    // Owner was notified of new registration
    expect(mockState.notifications).toHaveLength(1);
    expect(mockState.notifications[0].title).toBe("Nuevo usuario registrado");
    expect(mockState.notifications[0].content).toContain("Nuevo Usuario");
  });

  it("rejects invalid Stytch token with UNAUTHORIZED error", async () => {
    mockState.shouldFailStytch = true;
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.stytchCallback({
        token: "invalid-token-xyz",
        tokenType: "oauth",
        origin: "https://example.com",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(await caller.auth.me()).toBeNull();
  });

  it("returns user object when authenticated", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.email).toBe("user@example.com");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success for unauthenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    expect(await caller.auth.logout()).toEqual({ success: true });
  });

  it("revokes sessions and logs activity for authenticated user", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(mockState.insertedLogs.some((l) => l.eventType === "logout")).toBe(true);
  });
});

describe("trading.executeTrade", () => {
  it("executes trade and persists it for authenticated user", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.executeTrade({
      pair: "BTC-USD",
      side: "buy",
      amount: 0.05,
      price: 50000,
    });

    expect(result.success).toBe(true);
    expect(result.trade.total).toBe(2500);
    expect(mockState.insertedTrades).toHaveLength(1);
    expect(mockState.insertedTrades[0].pair).toBe("BTC-USD");
    expect(mockState.insertedTrades[0].side).toBe("buy");
  });

  it("notifies owner on significant trade (>= $1000)", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);

    await caller.trading.executeTrade({
      pair: "ETH-USD",
      side: "sell",
      amount: 1,
      price: 3500,
    });

    // notification is fire-and-forget; allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(mockState.notifications.some((n) => n.title.includes("Operación significativa"))).toBe(
      true
    );
  });

  it("does NOT notify owner on small trade (< $1000)", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);

    await caller.trading.executeTrade({
      pair: "SOL-USD",
      side: "buy",
      amount: 1,
      price: 100,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockState.notifications).toHaveLength(0);
  });

  it("rejects unauthenticated trade with UNAUTHORIZED", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.trading.executeTrade({
        pair: "BTC-USD",
        side: "buy",
        amount: 0.1,
        price: 50000,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("admin procedures", () => {
  it("admin.stats returns platform metrics including activeSessions", async () => {
    const ctx = createAuthedContext("admin");
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.admin.stats();
    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("totalTrades");
    expect(stats).toHaveProperty("totalVolume");
    expect(stats).toHaveProperty("activeSessions");
  });

  it("admin.stats rejects non-admin users with FORBIDDEN", async () => {
    const ctx = createAuthedContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin.stats rejects unauthenticated with UNAUTHORIZED", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("admin.getUserDetail returns user with logs, trades, portfolio and sessions", async () => {
    // First create a user via successful callback so mockState.user exists
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    await publicCaller.auth.stytchCallback({
      token: "valid",
      tokenType: "oauth",
      origin: "https://example.com",
    });

    const adminCtx = createAuthedContext("admin");
    const adminCaller = appRouter.createCaller(adminCtx);
    const detail = await adminCaller.admin.getUserDetail({ userId: 42 });

    expect(detail.user.id).toBe(42);
    expect(detail).toHaveProperty("logs");
    expect(detail).toHaveProperty("trades");
    expect(detail).toHaveProperty("portfolio");
    expect(detail).toHaveProperty("sessions");
    expect(detail.sessions.length).toBeGreaterThan(0);
  });
});
