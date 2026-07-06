import type { RevenueResult, RevenueSource } from "./types";

/**
 * Shopify revenue + COGS + gross profit via ShopifyQL (`FROM sales`), the same
 * engine behind the store's Analytics "gross profit" report. Using ShopifyQL
 * (rather than reconstructing from raw orders) guarantees the figures match the
 * store's own reports to the øre — net sales, COGS and gross profit all use
 * Shopify's internal definitions (net of discounts/returns, cost-at-sale, and
 * gross profit counts only items with a recorded cost).
 *
 * Requires the `read_reports` scope.
 *
 * Required env:
 *   SHOPIFY_STORE_DOMAIN   e.g. "858ebc.myshopify.com"
 *   SHOPIFY_ADMIN_TOKEN    Admin API access token (starts with shpat_)
 *   SHOPIFY_API_VERSION    optional; bump when Shopify retires the version (404)
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_TOKEN);
}

interface ShopifyqlResponse {
  data?: {
    shopifyqlQuery: {
      parseErrors: string[] | null;
      tableData: {
        columns: Array<{ name: string }>;
        rows: Array<Record<string, string>>;
      } | null;
    };
  };
  errors?: unknown;
}

async function shopifyql(query: string): Promise<Array<Record<string, string>>> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN!;
  const gql = `query($q: String!) {
    shopifyqlQuery(query: $q) {
      parseErrors
      tableData { columns { name } rows }
    }
  }`;
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
    },
    body: JSON.stringify({ query: gql, variables: { q: query } }),
  });
  if (!res.ok) throw new Error(`Shopify API ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as ShopifyqlResponse;
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  const result = json.data?.shopifyqlQuery;
  if (result?.parseErrors?.length) {
    throw new Error(`ShopifyQL parse error: ${result.parseErrors.join("; ")}`);
  }
  return result?.tableData?.rows ?? [];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Only these ShopifyQL metric names are allowed (guards the query string). */
export type SalesMetric = "net_sales" | "gross_profit" | "cost_of_goods_sold";

/** Daily values for a metric over an inclusive range, keyed by day-of-month. */
export async function shopifyDaily(
  metric: SalesMetric,
  start: string,
  end: string,
): Promise<Record<number, number>> {
  const rows = await shopifyql(
    `FROM sales SHOW ${metric} GROUP BY day SINCE ${start} UNTIL ${end} ORDER BY day`,
  );
  const byDay: Record<number, number> = {};
  for (const r of rows) byDay[Number(r.day.slice(8, 10))] = Number(r[metric] || 0);
  return byDay;
}

/** Total for a metric over an inclusive range. */
export async function shopifyTotal(metric: SalesMetric, start: string, end: string): Promise<number> {
  const rows = await shopifyql(`FROM sales SHOW ${metric} SINCE ${start} UNTIL ${end}`);
  return rows.reduce((acc, r) => acc + Number(r[metric] || 0), 0);
}

export const shopifyRevenueSource: RevenueSource = {
  name: "Shopify",
  async getRevenue(start: string, end: string): Promise<RevenueResult> {
    if (!shopifyConfigured()) throw new Error("Shopify is not configured");

    const query =
      `FROM sales SHOW net_sales, cost_of_goods_sold, gross_profit ` +
      `SINCE ${start} UNTIL ${end}`;
    const rows = await shopifyql(query);

    // A date range without a GROUP BY returns a single aggregate row, but sum
    // defensively in case Shopify ever returns one row per sub-period.
    const sum = (key: string) => rows.reduce((acc, r) => acc + Number(r[key] || 0), 0);

    return {
      netSales: round2(sum("net_sales")),
      cogs: round2(sum("cost_of_goods_sold")),
      grossProfit: round2(sum("gross_profit")),
    };
  },
};
