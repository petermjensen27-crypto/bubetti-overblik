import { VAT_RATE } from "./config";

/** The raw numbers pulled from the sources, plus identity. */
export interface RawSnapshot {
  year: number;
  month: number;
  split: "half" | "full";
  /** Shopify net sales, excl. VAT & shipping (DKK). */
  netSales: number;
  /** Shopify cost of goods sold (DKK). */
  cogs: number;
  /** Shopify gross profit (DKK) — pulled directly, not derived from netSales−cogs. */
  grossProfit: number;
  spendGoogle: number;
  spendMeta: number;
}

/** Everything the overview shows — raw inputs plus derived figures. */
export interface Metrics {
  /** Net sales excl. VAT (Shopify). */
  netSales: number;
  /** Omsætning: net sales grossed up for Danish VAT (25%), matching the sheet. */
  revenueInclVat: number;
  cogs: number;
  /** Dækningsbidrag = Shopify gross profit. */
  db: number;
  spendGoogle: number;
  spendMeta: number;
  spend: number;
  /** DB − spend. */
  contributionMargin: number;
  /** DB ÷ net sales (Shopify gross margin). */
  dbPct: number;
  /** Marketing Efficiency Ratio: revenue incl. VAT ÷ spend. */
  mer: number;
  /** DB ÷ spend. */
  mpr: number;
}

/** Divide guarding against a zero denominator (returns 0 rather than NaN/∞). */
function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function computeMetrics(raw: RawSnapshot): Metrics {
  const revenueInclVat = raw.netSales * (1 + VAT_RATE);
  const db = raw.grossProfit;
  const spend = raw.spendGoogle + raw.spendMeta;

  return {
    netSales: raw.netSales,
    revenueInclVat,
    cogs: raw.cogs,
    db,
    spendGoogle: raw.spendGoogle,
    spendMeta: raw.spendMeta,
    spend,
    contributionMargin: db - spend,
    dbPct: safeDiv(db, raw.netSales),
    mer: safeDiv(revenueInclVat, spend),
    mpr: safeDiv(db, spend),
  };
}
