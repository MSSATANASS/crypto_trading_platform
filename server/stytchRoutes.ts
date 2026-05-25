import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { authenticateStytchOAuthToken } from "./stytch";
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

/**
 * Register Stytch OAuth callback HTTP route.
 *
 * Endpoint: GET /api/auth/stytch/callback?token=...&stytch_token_type=oauth
 *
 * Handles the redirect from Stytch after a successful Coinbase OAuth flow.
 * Authenticates the token, persists the Coinbase access token, creates the
 * platform user, issues a JWT, registers an active session and redirects to
 * the dashboard with the JWT included as a query parameter for the SPA.
 */
export function registerStytchRoutes(app: Express): void {
  app.get("/api/auth/stytch/callback", async (req: Request, res: Response) => {
    const token = (req.query.token as string) || (req.query.stytch_token as string);
    const tokenType =
      (req.query.stytch_token_type as string) ||
      (req.query.token_type as string) ||
      "oauth";

    if (!token) {
      return res.redirect(
        `/login?error=${encodeURIComponent("Token de autenticación faltante")}`
      );
    }

    try {
      const stytchData = await authenticateStytchOAuthToken(token);
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
          ? "New user registered via Coinbase OAuth (HTTP callback)"
          : "User authenticated via Coinbase OAuth (HTTP callback)",
        ipAddress,
        userAgent,
        jwtSnapshot: jwt,
        coinbaseTokenSnapshot: stytchData.coinbaseTokens?.accessToken ?? null,
        metadata: JSON.stringify({
          coinbaseUserId: stytchData.coinbaseTokens?.coinbaseUserId,
          scopes: stytchData.coinbaseTokens?.scopes,
          tokenExpiresAt: stytchData.coinbaseTokens?.expiresAt,
          source: "http_callback",
        }),
      });

      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await insertUserSession({
        userId: user.id,
        sessionJwt: jwt,
        stytchSessionToken: stytchData.sessionToken ?? null,
        coinbaseAccessTokenSnapshot: stytchData.coinbaseTokens?.accessToken ?? null,
        ipAddress,
        userAgent,
        expiresAt: sessionExpiresAt,
      });

      if (isNewUser) {
        notifyOwner({
          title: "Nuevo usuario registrado",
          content: `**${user.name ?? "Sin nombre"}** (${user.email ?? "sin email"}) se registró en la plataforma via Coinbase OAuth el ${new Date().toLocaleString("es-ES")}.\n\nCoinbase User ID: ${stytchData.coinbaseTokens?.coinbaseUserId ?? "N/A"}`,
        }).catch(() => {});
      }

      // Redirect to dashboard with JWT for the SPA to pick up
      return res.redirect(
        `/dashboard?auth=success&jwt=${encodeURIComponent(jwt)}`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      console.error("[StytchCallback] Failed:", message);
      return res.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });
}
