/**
 * Result of a revenue pull for a date range (inclusive, YYYY-MM-DD).
 * All figures come straight from Shopify's analytics (ShopifyQL `FROM sales`),
 * so they match the store's own reports exactly.
 */
export interface RevenueResult {
  /** Shopify net sales, excl. VAT & shipping, net of discounts/returns (DKK). */
  netSales: number;
  /** Shopify cost of goods sold (DKK). */
  cogs: number;
  /**
   * Shopify gross profit (= net sales with cost recorded − COGS). This is NOT
   * netSales − cogs, because sales of items without a recorded cost are excluded.
   */
  grossProfit: number;
}

export interface RevenueSource {
  readonly name: string;
  getRevenue(start: string, end: string): Promise<RevenueResult>;
}

export interface SpendSource {
  /** Machine name: "google" | "meta". */
  readonly key: "google" | "meta";
  readonly name: string;
  /** Ad spend in DKK for the inclusive date range. */
  getSpend(start: string, end: string): Promise<number>;
}
