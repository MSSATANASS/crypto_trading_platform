import * as stytch from "stytch";
import { ENV } from "./_core/env";

let _client: stytch.Client | null = null;

export function getStytchClient(): stytch.Client {
  if (!_client) {
    const projectId = process.env.STYTCH_PROJECT_ID;
    const secret = process.env.STYTCH_SECRET;

    if (!projectId || !secret) {
      throw new Error("Stytch credentials not configured. Set STYTCH_PROJECT_ID and STYTCH_SECRET.");
    }

    _client = new stytch.Client({ project_id: projectId, secret });
  }
  return _client;
}

export interface StytchOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
  coinbaseUserId?: string;
}

/**
 * Authenticate a Stytch OAuth token and extract Coinbase OAuth tokens.
 * Returns the authenticated user data and provider tokens.
 */
export async function authenticateStytchOAuthToken(token: string): Promise<{
  userId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  sessionToken?: string;
  coinbaseTokens?: StytchOAuthTokens;
}> {
  const client = getStytchClient();

  const response = await client.oauth.authenticate({
    token,
    session_duration_minutes: 60 * 24 * 7, // 7 days
  });

  const user = response.user;
  const providerValues = response.provider_values as Record<string, any> | undefined;

  // Extract Coinbase access token from provider_values
  let coinbaseTokens: StytchOAuthTokens | undefined;
  if (providerValues) {
    const expiresAt = providerValues.expires_at
      ? new Date(providerValues.expires_at)
      : undefined;

    coinbaseTokens = {
      accessToken: (providerValues.access_token as string) ?? "",
      refreshToken: (providerValues.refresh_token as string) ?? undefined,
      expiresAt,
      scopes: Array.isArray(providerValues.scopes)
        ? providerValues.scopes.join(",")
        : ((providerValues.scopes as string | undefined) ?? undefined),
      coinbaseUserId:
        (providerValues.provider_subject as string) ??
        (providerValues.subject as string) ??
        undefined,
    };
  }

  // Extract name from user object
  const userAny = user as any;
  const firstName = userAny?.name?.first_name ?? "";
  const lastName = userAny?.name?.last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || undefined;

  // Extract email
  const email = userAny?.emails?.[0]?.email ?? undefined;

  // Extract avatar
  const avatarUrl = userAny?.providers?.[0]?.profile_image_url ?? undefined;

  return {
    userId: user.user_id,
    email,
    name: fullName,
    avatarUrl,
    sessionToken: response.session_token,
    coinbaseTokens,
  };
}
