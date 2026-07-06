import type { SpendSource } from "./types";

/**
 * Google Ads spend via the Google Ads API (GAQL).
 *
 * cost_micros is returned in the account's currency (expected DKK); we divide
 * by 1e6. An OAuth access token is minted from the stored refresh token.
 *
 * Required env:
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_REFRESH_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID          (digits only, no dashes)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID    optional manager account (digits only)
 */

// Google sunsets API versions ~yearly; override via env when bumping.
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v21";

export function googleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

interface SearchStreamChunk {
  results?: Array<{ metrics?: { costMicros?: string } }>;
}

export const googleAdsSource: SpendSource = {
  key: "google",
  name: "Google Ads",
  async getSpend(start: string, end: string): Promise<number> {
    if (!googleAdsConfigured()) throw new Error("Google Ads is not configured");

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
    const accessToken = await getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      "Content-Type": "application/json",
    };
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    }

    const gaql = `
      SELECT metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${start}' AND '${end}'`;

    const res = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      { method: "POST", headers, body: JSON.stringify({ query: gaql }) },
    );
    if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${await res.text()}`);

    const chunks = (await res.json()) as SearchStreamChunk[];
    let micros = 0;
    for (const chunk of chunks) {
      for (const row of chunk.results ?? []) {
        micros += Number(row.metrics?.costMicros ?? 0);
      }
    }
    return Math.round((micros / 1_000_000) * 100) / 100;
  },
};
