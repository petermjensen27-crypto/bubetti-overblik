import { googleAdsConfigured, googleAdsSource } from "./google-ads";
import { metaConfigured, metaSource } from "./meta";
import { mockGoogleSource, mockMetaSource, mockRevenueSource } from "./mock";
import { shopifyConfigured, shopifyRevenueSource } from "./shopify";
import type { RevenueSource, SpendSource } from "./types";

/**
 * Selects live adapters when their credentials are present, otherwise mocks.
 * Set USE_MOCK_DATA=true to force mocks even when credentials exist (useful for
 * local development against production env files).
 */
function forceMock(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

export function getRevenueSource(): RevenueSource {
  return !forceMock() && shopifyConfigured() ? shopifyRevenueSource : mockRevenueSource;
}

export function getSpendSources(): SpendSource[] {
  const google =
    !forceMock() && googleAdsConfigured() ? googleAdsSource : mockGoogleSource;
  const meta = !forceMock() && metaConfigured() ? metaSource : mockMetaSource;
  return [google, meta];
}

/** Which sources are live vs. mocked — surfaced in the UI as a data-health hint. */
export function sourceStatus() {
  const live = !forceMock();
  return {
    shopify: live && shopifyConfigured(),
    google: live && googleAdsConfigured(),
    meta: live && metaConfigured(),
  };
}

export type { RevenueSource, SpendSource } from "./types";
