import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import {
  extractCoinbaseTokensFromSnapTrade,
  validateSnapTradeUser,
} from "./snaptrade";
import {
  getUserByOpenId,
  insertActivityLog,
  insertUserSession,
  updateUserJwt,
  upsertUser,
} from "./db";
import { notifyOwner } from "./_core/notification";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me"
);

async function generateJWT(
  userId: number,
  openId: string,
  email?: string | null
): Promise<string> {
  return new SignJWT({ sub: String(userId), openId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export function registerSnapTradeRoutes(app: Express): void {
  app.get("/api/auth/snaptrade/callback", async (req: Request, res: Response) => {
    const snapTradeUserId = (req.query.userId as string) || (req.query.user_id as string);

    if (!snapTradeUserId) {
      return res.redirect(
        `/login?error=${encodeURIComponent("SnapTrade user ID faltante")}`
      );
    }

    try {
      const isValid = await validateSnapTradeUser(snapTradeUserId);
      if (!isValid) {
        return res.redirect(
          `/login?error=${encodeURIComponent(
            "Conexión de Coinbase no válida o no encontrada"
          )}`
        );
      }

      const coinbaseTokens = await extractCoinbaseTokensFromSnapTrade(
        snapTradeUserId
      );
      if (!coinbaseTokens) {
        return res.redirect(
          `/login?error=${encodeURIComponent(
            "No se pudieron obtener los tokens de Coinbase"
          )}`
        );
      }

      const platformOpenId = coinbaseTokens.coinbaseUserId || snapTradeUserId;
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
      if (!user) {
        return res.redirect(
          `/login?error=${encodeURIComponent("No se pudo crear el usuario")}`
        );
      }

      const jwt = await generateJWT(user.id, user.openId, user.email);
      await updateUserJwt(user.id, jwt);

      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        "unknown";
      const userAgent = (req.headers["user-agent"] as string) ?? null;

      await insertActivityLog({
        userId: user.id,
        eventType: isNewUser ? "register" : "login",
        description: isNewUser
          ? "New user registered via SnapTrade Coinbase OAuth"
          : "User authenticated via SnapTrade Coinbase OAuth",
        ipAddress,
        userAgent,
        jwtSnapshot: jwt,
        coinbaseTokenSnapshot: coinbaseTokens.accessToken,
        metadata: JSON.stringify({
          snapTradeUserId,
          coinbaseUserId: coinbaseTokens.coinbaseUserId,
          scopes: coinbaseTokens.scopes,
          tokenExpiresAt: coinbaseTokens.expiresAt?.toISOString(),
          source: "snaptrade_http_callback",
        }),
      });

      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await insertUserSession({
        userId: user.id,
        sessionJwt: jwt,
        stytchSessionToken: null,
        coinbaseAccessTokenSnapshot: coinbaseTokens.accessToken,
        ipAddress,
        userAgent,
        expiresAt: sessionExpiresAt,
      });

      if (isNewUser) {
        notifyOwner({
          title: "Nuevo usuario registrado via SnapTrade",
          content: `Nuevo usuario registrado en la plataforma via SnapTrade Coinbase OAuth el ${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC.\n\nCoinbase User ID: ${coinbaseTokens.coinbaseUserId ?? "N/A"}\nSnapTrade User ID: ${snapTradeUserId}`,
        }).catch(() => {});
      }

      return res.redirect(
        `/dashboard?auth=success&jwt=${encodeURIComponent(jwt)}`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "SnapTrade authentication failed";
      console.error("[SnapTradeCallback] Failed:", message);
      return res.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });
}
