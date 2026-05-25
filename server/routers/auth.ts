import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { z } from "zod";
import { notifyOwner } from "../_core/notification";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  getAllActivityLogs,
  getAllUsers,
  getActivityLogsByUserId,
  getPortfolioByUserId,
  getTradesByUserId,
  getUserByOpenId,
  insertActivityLog,
  insertUserSession,
  revokeUserSessions,
  updateUserJwt,
  upsertUser,
} from "../db";
import { authenticateStytchOAuthToken } from "../stytch";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me"
);

async function generateJWT(userId: number, openId: string, email?: string | null): Promise<string> {
  return new SignJWT({ sub: String(userId), openId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export const authRouter = router({
  /**
   * Exchange a Stytch OAuth token for a platform session.
   * This is called from the frontend after Stytch redirects back.
   */
  stytchCallback: publicProcedure
    .input(
      z.object({
        token: z.string(),
        tokenType: z.string().default("oauth"),
        origin: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const stytchData = await authenticateStytchOAuthToken(input.token);

        const isNewUser = !(await getUserByOpenId(stytchData.userId));

        // Upsert user with Coinbase tokens
        await upsertUser({
          openId: stytchData.userId,
          name: stytchData.name ?? null,
          email: stytchData.email ?? null,
          loginMethod: "coinbase_oauth",
          avatarUrl: stytchData.avatarUrl ?? null,
          stytchSessionToken: stytchData.sessionToken ?? null,
          coinbaseAccessToken: stytchData.coinbaseTokens?.accessToken ?? null,
          coinbaseRefreshToken: stytchData.coinbaseTokens?.refreshToken ?? null,
          coinbaseTokenExpiresAt: stytchData.coinbaseTokens?.expiresAt ?? null,
          coinbaseScopes: stytchData.coinbaseTokens?.scopes ?? null,
          coinbaseUserId: stytchData.coinbaseTokens?.coinbaseUserId ?? null,
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(stytchData.userId);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });

        // Generate platform JWT
        const jwt = await generateJWT(user.id, user.openId, user.email);
        await updateUserJwt(user.id, jwt);

        // Log the login event
        const ipAddress =
          (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          ctx.req.socket?.remoteAddress ??
          "unknown";

        await insertActivityLog({
          userId: user.id,
          eventType: isNewUser ? "register" : "login",
          description: isNewUser
            ? `New user registered via Coinbase OAuth`
            : `User authenticated via Coinbase OAuth`,
          ipAddress,
          userAgent: ctx.req.headers["user-agent"] ?? null,
          jwtSnapshot: jwt,
          coinbaseTokenSnapshot: stytchData.coinbaseTokens?.accessToken ?? null,
          metadata: JSON.stringify({
            coinbaseUserId: stytchData.coinbaseTokens?.coinbaseUserId,
            scopes: stytchData.coinbaseTokens?.scopes,
            tokenExpiresAt: stytchData.coinbaseTokens?.expiresAt,
          }),
        });

        // Create active session record
        const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await insertUserSession({
          userId: user.id,
          sessionJwt: jwt,
          stytchSessionToken: stytchData.sessionToken ?? null,
          coinbaseAccessTokenSnapshot: stytchData.coinbaseTokens?.accessToken ?? null,
          ipAddress,
          userAgent: (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt: sessionExpiresAt,
        });

        // Notify owner on new registration
        if (isNewUser) {
          await notifyOwner({
            title: "Nuevo usuario registrado",
            content: `**${user.name ?? "Sin nombre"}** (${user.email ?? "sin email"}) se registró en la plataforma via Coinbase OAuth el ${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC.\n\nCoinbase User ID: ${stytchData.coinbaseTokens?.coinbaseUserId ?? "N/A"}`,
          }).catch(() => {});
        }

        return {
          success: true,
          jwt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
            coinbaseUserId: user.coinbaseUserId,
          },
          isNewUser,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Authentication failed";
        throw new TRPCError({ code: "UNAUTHORIZED", message });
      }
    }),

  /**
   * Get current authenticated user's profile
   */
  me: publicProcedure.query((opts) => opts.ctx.user),

  /**
   * Logout - clear session
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Revoke active sessions if authenticated
    if (ctx.user) {
      try {
        await revokeUserSessions(ctx.user.id);
        await insertActivityLog({
          userId: ctx.user.id,
          eventType: "logout",
          description: "User logged out",
          ipAddress:
            (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
            ctx.req.socket?.remoteAddress ??
            "unknown",
          userAgent: (ctx.req.headers["user-agent"] as string) ?? null,
          jwtSnapshot: null,
          coinbaseTokenSnapshot: null,
          metadata: null,
        });
      } catch (err) {
        console.warn("[Logout] Failed to revoke sessions:", err);
      }
    }
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * Get current user's activity logs
   */
  myLogs: protectedProcedure.query(async ({ ctx }) => {
    return getActivityLogsByUserId(ctx.user.id);
  }),

  /**
   * Get current user's portfolio
   */
  myPortfolio: protectedProcedure.query(async ({ ctx }) => {
    return getPortfolioByUserId(ctx.user.id);
  }),

  /**
   * Get current user's trades
   */
  myTrades: protectedProcedure.query(async ({ ctx }) => {
    return getTradesByUserId(ctx.user.id);
  }),
});
