import type { SpendSource } from "./types";

/**
 * Meta (Facebook/Instagram) ad spend via the Marketing API Insights endpoint.
 *
 * Required env:
 *   META_ACCESS_TOKEN     long-lived system-user token with ads_read
 *   META_AD_ACCOUNT_ID    e.g. "act_1234567890"
 *   META_API_VERSION      optional, defaults to a recent version
 */

// Meta deprecates versions ~every 2 years; override via env when needed.
const API_VERSION = process.env.META_API_VERSION || "v23.0";

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

interface InsightsResponse {
  data?: Array<{ spend?: string }>;
  error?: { message: string };
}

export const metaSource: SpendSource = {
  key: "meta",
  name: "Meta Ads",
  async getSpend(start: string, end: string): Promise<number> {
    if (!metaConfigured()) throw new Error("Meta is not configured");

    const account = process.env.META_AD_ACCOUNT_ID!;
    const params = new URLSearchParams({
      access_token: process.env.META_ACCESS_TOKEN!,
      time_range: JSON.stringify({ since: start, until: end }),
      fields: "spend",
      level: "account",
    });

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${account}/insights?${params}`,
    );
    const json = (await res.json()) as InsightsResponse;
    if (json.error) throw new Error(`Meta API error: ${json.error.message}`);

    const spend = (json.data ?? []).reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
    return Math.round(spend * 100) / 100;
  },
};
