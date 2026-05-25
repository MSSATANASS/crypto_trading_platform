import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllActivityLogs,
  getAllActiveSessions,
  getAllSessionsByUserId,
  getAllTrades,
  getAllUsers,
  getActivityLogsByUserId,
  getPortfolioByUserId,
  getTradesByUserId,
  getUserById,
} from "../db";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access restricted to administrators.",
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  /**
   * List all registered users with profile data
   */
  listUsers: adminProcedure.query(async () => {
    const users = await getAllUsers();
    // Mask sensitive token data - show only partial token for security
    return users.map((u) => ({
      ...u,
      coinbaseAccessToken: u.coinbaseAccessToken
        ? `${u.coinbaseAccessToken.substring(0, 12)}...${u.coinbaseAccessToken.slice(-6)}`
        : null,
      coinbaseRefreshToken: u.coinbaseRefreshToken
        ? `${u.coinbaseRefreshToken.substring(0, 8)}...`
        : null,
      lastJwt: u.lastJwt
        ? `${u.lastJwt.substring(0, 20)}...${u.lastJwt.slice(-10)}`
        : null,
    }));
  }),

  /**
   * Get full user detail including raw tokens (admin only)
   */
  getUserDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const logs = await getActivityLogsByUserId(input.userId);
      const trades = await getTradesByUserId(input.userId);
      const portfolio = await getPortfolioByUserId(input.userId);
      const sessions = await getAllSessionsByUserId(input.userId);

      return { user, logs, trades, portfolio, sessions };
    }),

  /**
   * Get all activity logs across all users
   */
  allLogs: adminProcedure.query(async () => {
    return getAllActivityLogs();
  }),

  /**
   * Get all trades across all users
   */
  allTrades: adminProcedure.query(async () => {
    return getAllTrades();
  }),

  /**
   * Get platform stats
   */
  stats: adminProcedure.query(async () => {
    const users = await getAllUsers();
    const logs = await getAllActivityLogs();
    const trades = await getAllTrades();

    const totalVolume = trades.reduce((sum, t) => sum + parseFloat(t.total), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = users.filter((u) => u.createdAt >= today).length;
    const tradesLast24h = trades.filter(
      (t) => t.createdAt >= new Date(Date.now() - 86400000)
    ).length;

    const activeSessions = await getAllActiveSessions();

    return {
      totalUsers: users.length,
      newUsersToday,
      totalTrades: trades.length,
      tradesLast24h,
      totalVolume: totalVolume.toFixed(2),
      totalLogs: logs.length,
      activeSessions: activeSessions.length,
    };
  }),
});
