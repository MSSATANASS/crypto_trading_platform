import axios, { AxiosInstance } from "axios";

/**
 * SnapTrade Client Configuration
 * Handles communication with SnapTrade API to obtain Coinbase OAuth tokens
 */

interface SnapTradeConfig {
  clientId: string;
  clientSecret: string;
  consumerKey: string;
  environment: "sandbox" | "production";
}

interface SnapTradeConnectionResponse {
  authorizationId: string;
  brokerageAuthorizationId: string;
  connectionPortalUrl?: string;
  brokerage: {
    id: string;
    name: string;
  };
  createdDate: string;
  updatedDate: string;
  disabled: boolean;
  meta?: {
    coinbaseAccessToken?: string;
    coinbaseRefreshToken?: string;
    coinbaseTokenExpiresAt?: string;
    coinbaseScopes?: string;
    coinbaseUserId?: string;
    [key: string]: unknown;
  };
}

interface SnapTradeUserConnections {
  connections: SnapTradeConnectionResponse[];
}

let _client: AxiosInstance | null = null;
let _config: SnapTradeConfig | null = null;

export function initializeSnapTradeClient(config: SnapTradeConfig): void {
  _config = config;

  const baseURL =
    config.environment === "production"
      ? "https://api.snaptrade.com/api/v1"
      : "https://api.sandbox.snaptrade.com/api/v1";

  _client = axios.create({
    baseURL,
    auth: {
      username: config.consumerKey,
      password: config.clientSecret,
    },
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

export function getSnapTradeClient(): AxiosInstance {
  if (!_client) {
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const clientSecret = process.env.SNAPTRADE_CLIENT_SECRET;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
    const environment = (process.env.SNAPTRADE_ENVIRONMENT ?? "sandbox") as
      | "sandbox"
      | "production";

    if (!clientId || !clientSecret || !consumerKey) {
      throw new Error(
        "SnapTrade credentials not configured. Set SNAPTRADE_CLIENT_ID, SNAPTRADE_CLIENT_SECRET, and SNAPTRADE_CONSUMER_KEY."
      );
    }

    initializeSnapTradeClient({
      clientId,
      clientSecret,
      consumerKey,
      environment,
    });
  }

  if (!_client) {
    throw new Error("Failed to initialize SnapTrade client");
  }

  return _client;
}

export async function getSnapTradeUserConnection(
  userId: string,
  brokerageId: string = "COINBASE"
): Promise<SnapTradeConnectionResponse | null> {
  try {
    const client = getSnapTradeClient();
    const response = await client.get<SnapTradeUserConnections>(
      `/users/${userId}/connections`
    );

    if (!response.data.connections || response.data.connections.length === 0) {
      return null;
    }

    const coinbaseConnection = response.data.connections.find(
      conn => conn.brokerage.id === brokerageId
    );

    return coinbaseConnection || null;
  } catch (error) {
    console.error("[SnapTrade] Failed to get user connection:", error);
    throw error;
  }
}

export interface CoinbaseTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
  coinbaseUserId?: string;
}

export async function extractCoinbaseTokensFromSnapTrade(
  userId: string
): Promise<CoinbaseTokens | null> {
  try {
    const connection = await getSnapTradeUserConnection(userId, "COINBASE");

    if (!connection) {
      console.warn(
        `[SnapTrade] No Coinbase connection found for user ${userId}`
      );
      return null;
    }

    const meta = connection.meta;
    if (!meta || !meta.coinbaseAccessToken) {
      console.warn(
        `[SnapTrade] No Coinbase tokens found in connection meta for user ${userId}`
      );
      return null;
    }

    const expiresAtStr = meta.coinbaseTokenExpiresAt as string | undefined;
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : undefined;

    return {
      accessToken: meta.coinbaseAccessToken as string,
      refreshToken: (meta.coinbaseRefreshToken as string) || undefined,
      expiresAt,
      scopes: (meta.coinbaseScopes as string) || undefined,
      coinbaseUserId: (meta.coinbaseUserId as string) || undefined,
    };
  } catch (error) {
    console.error("[SnapTrade] Failed to extract Coinbase tokens:", error);
    throw error;
  }
}

export async function validateSnapTradeUser(userId: string): Promise<boolean> {
  try {
    const connection = await getSnapTradeUserConnection(userId, "COINBASE");
    return connection !== null && !connection.disabled;
  } catch (error) {
    console.error("[SnapTrade] Failed to validate user:", error);
    return false;
  }
}

export async function getConnectionPortalUrl(userId: string): Promise<string> {
  try {
    const client = getSnapTradeClient();
    const response = await client.post<{ portal_url: string }>(
      `/users/${userId}/connections/portal`,
      {
        brokerage: "COINBASE",
        redirect_uri: process.env.VITE_SNAPTRADE_REDIRECT_URI,
      }
    );

    return response.data.portal_url;
  } catch (error) {
    console.error("[SnapTrade] Failed to get connection portal URL:", error);
    throw error;
  }
}

export async function revokeSnapTradeConnection(
  userId: string,
  brokerageId: string = "COINBASE"
): Promise<void> {
  try {
    const client = getSnapTradeClient();

    const connection = await getSnapTradeUserConnection(userId, brokerageId);
    if (!connection) {
      console.warn(
        `[SnapTrade] No connection found to revoke for user ${userId}`
      );
      return;
    }

    await client.delete(
      `/users/${userId}/connections/${connection.authorizationId}`
    );

    console.log(
      `[SnapTrade] Successfully revoked ${brokerageId} connection for user ${userId}`
    );
  } catch (error) {
    console.error("[SnapTrade] Failed to revoke connection:", error);
    throw error;
  }
}

export async function checkSnapTradeHealth(): Promise<boolean> {
  try {
    const client = getSnapTradeClient();
    const response = await client.get("/status");
    return response.status === 200;
  } catch (error) {
    console.error("[SnapTrade] Health check failed:", error);
    return false;
  }
}
