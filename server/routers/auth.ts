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
  getDb,
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
import {
  extractCoinbaseTokensFromSnapTrade,
  getConnectionPortalUrl,
  validateSnapTradeUser,
} from "../snaptrade";

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
  createSnapTradePortal: publicProcedure
    .input(
      z.object({
        snapTradeUserId: z.string().min(1, "SnapTrade user ID is required"),
        origin: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const normalizedOrigin =
        input.origin && /^https?:\/\//.test(input.origin)
          ? input.origin.replace(/\/$/, "")
          : "http://localhost:3000";
      const redirectUri = `${normalizedOrigin}/api/auth/snaptrade/callback`;
      const portalUrl = await getConnectionPortalUrl(
        input.snapTradeUserId,
        redirectUri
      );

      return {
        success: true,
        portalUrl,
        redirectUri,
      };
    }),

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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available. Set DATABASE_URL.",
          });
        }

        const stytchData = await authenticateStytchOAuthToken(input.token);

        const isNewUser = !(await getUserByOpenId(stytchData.userId));

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

        const jwt = await generateJWT(user.id, user.openId, user.email);
        await updateUserJwt(user.id, jwt);

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

        const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await insertUserSession({
          userId: user.id,
          sessionJwt: jwt,
          stytchSessionToken: stytchData.sessionToken ?? null,
          coinbaseAccessTokenSnapshot: stytchData.coinbaseTokens?.accessToken ?? null,
          ipAddress,
          userAgent: (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt: sessionExpiresAt,
        });

        if (isNewUser) {
          await notifyOwner({
            title: "New user registered",
            content: `**${user.name ?? "Unnamed"}** (${user.email ?? "no email"}) registered on the platform via Coinbase OAuth on ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC.\n\nCoinbase User ID: ${stytchData.coinbaseTokens?.coinbaseUserId ?? "N/A"}`,
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
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "Authentication failed";
        const isConfigError =
          message.toLowerCase().includes("not configured") ||
          message.toLowerCase().includes("database_url");
        throw new TRPCError({
          code: isConfigError ? "INTERNAL_SERVER_ERROR" : "UNAUTHORIZED",
          message,
        });
      }
    }),

  /**
   * SnapTrade OAuth callback - tRPC mutation
   * Called from the frontend after SnapTrade portal closes
   */
  snaptradeCallback: publicProcedure
    .input(
      z.object({
        snapTradeUserId: z.string().min(1, "SnapTrade user ID is required"),
        origin: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available. Set DATABASE_URL.",
          });
        }

        const isValid = await validateSnapTradeUser(input.snapTradeUserId);
        if (!isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "SnapTrade user not found or Coinbase connection is not active",
          });
        }

        const coinbaseTokens = await extractCoinbaseTokensFromSnapTrade(
          input.snapTradeUserId
        );
        if (!coinbaseTokens) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to extract Coinbase tokens from SnapTrade",
          });
        }

        const platformOpenId =
          coinbaseTokens.coinbaseUserId || input.snapTradeUserId;

        const isNewUser = !(await getUserByOpenId(platformOpenId));

        await upsertUser({
          openId: platformOpenId,
          name: null,
          email: null,
          loginMethod: "snaptrade_coinbase_oauth",
          avatarUrl: null,
          coinbaseAccessToken: coinbaseTokens.accessToken,
          coinbaseRefreshToken: coinbaseTokens.refreshToken ?? null,
          coinbaseTokenExpiresAt: coinbaseTokens.expiresAt ?? null,
          coinbaseScopes: coinbaseTokens.scopes ?? null,
          coinbaseUserId: coinbaseTokens.coinbaseUserId ?? null,
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(platformOpenId);
        if (!user)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });

        const jwt = await generateJWT(user.id, user.openId, user.email);
        await updateUserJwt(user.id, jwt);

        const ipAddress =
          (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          ctx.req.socket?.remoteAddress ??
          "unknown";

        await insertActivityLog({
          userId: user.id,
          eventType: isNewUser ? "register" : "login",
          description: isNewUser
            ? `New user registered via SnapTrade Coinbase OAuth`
            : `User authenticated via SnapTrade Coinbase OAuth`,
          ipAddress,
          userAgent: ctx.req.headers["user-agent"] ?? null,
          jwtSnapshot: jwt,
          coinbaseTokenSnapshot: coinbaseTokens.accessToken,
          metadata: JSON.stringify({
            snapTradeUserId: input.snapTradeUserId,
            coinbaseUserId: coinbaseTokens.coinbaseUserId,
            scopes: coinbaseTokens.scopes,
            tokenExpiresAt: coinbaseTokens.expiresAt?.toISOString(),
            source: "snaptrade_trpc_callback",
          }),
        });

        const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await insertUserSession({
          userId: user.id,
          sessionJwt: jwt,
          stytchSessionToken: null,
          coinbaseAccessTokenSnapshot: coinbaseTokens.accessToken,
          ipAddress,
          userAgent: (ctx.req.headers["user-agent"] as string) ?? null,
          expiresAt: sessionExpiresAt,
        });

        if (isNewUser) {
          await notifyOwner({
            title: "Nuevo usuario registrado via SnapTrade",
            content: `**${user.name ?? "Sin nombre"}** se registró en la plataforma via SnapTrade Coinbase OAuth el ${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC.\n\nCoinbase User ID: ${coinbaseTokens.coinbaseUserId ?? "N/A"}`,
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
        const message =
          error instanceof Error
            ? error.message
            : "SnapTrade authentication failed";
        throw new TRPCError({ code: "UNAUTHORIZED", message });
      }
    }),

  me: publicProcedure.query(opts => opts.ctx.user),

  logout: publicProcedure.mutation(async ({ ctx }) => {
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

  myLogs: protectedProcedure.query(async ({ ctx }) => {
    return getActivityLogsByUserId(ctx.user.id);
  }),

  myPortfolio: protectedProcedure.query(async ({ ctx }) => {
    return getPortfolioByUserId(ctx.user.id);
  }),

  myTrades: protectedProcedure.query(async ({ ctx }) => {
    return getTradesByUserId(ctx.user.id);
  }),
});
