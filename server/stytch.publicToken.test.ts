import { describe, expect, it } from "vitest";

/**
 * Validates VITE_STYTCH_PUBLIC_TOKEN configuration.
 * The public token is required by the frontend SDK to initiate the Coinbase OAuth
 * flow. Public tokens have the format `public-token-(test|live)-<uuid>`.
 *
 * Note: We cannot call Stytch's OAuth start endpoint from a unit test because
 * it expects a browser redirect, not a JSON response. Instead we validate
 * (a) the env var exists, (b) the prefix matches Stytch's documented format.
 */
describe("VITE_STYTCH_PUBLIC_TOKEN configuration", () => {
  it("is set in the environment", () => {
    const token = process.env.VITE_STYTCH_PUBLIC_TOKEN;
    expect(token, "VITE_STYTCH_PUBLIC_TOKEN must be configured").toBeTruthy();
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(10);
  });

  it("matches the Stytch public token format", () => {
    const token = process.env.VITE_STYTCH_PUBLIC_TOKEN as string;
    // Stytch public tokens are prefixed with `public-token-test-` or `public-token-live-`
    // followed by a uuid-like identifier.
    const pattern = /^public-token-(test|live)-[0-9a-f-]{20,}$/i;
    expect(token).toMatch(pattern);
  });
});
