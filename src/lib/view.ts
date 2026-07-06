import type { Metrics } from "./metrics";
import type { Split } from "./periods";

/**
 * Client-safe view types and helpers (no server/node imports), so both server
 * pages and client components can share them.
 */
export interface PeriodRow {
  year: number;
  month: number;
  split: Split;
  metrics: Metrics;
  note: string | null;
  capturedAt: string;
}

export const METRIC_KEYS = [
  "revenueInclVat",
  "db",
  "spend",
  "contributionMargin",
  "dbPct",
  "mer",
  "mpr",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenueInclVat: "Omsætning",
  db: "DB",
  spend: "Spend",
  contributionMargin: "Contribution margin",
  dbPct: "DB %",
  mer: "MER",
  mpr: "MPR",
};

export const METRIC_FORMAT: Record<MetricKey, "money" | "percent" | "ratio"> = {
  revenueInclVat: "money",
  db: "money",
  spend: "money",
  contributionMargin: "money",
  dbPct: "percent",
  mer: "ratio",
  mpr: "ratio",
};

export function distinctMonths(rows: PeriodRow[]): number[] {
  return [...new Set(rows.map((r) => r.month))].sort((a, b) => a - b);
}

export function distinctYears(rows: PeriodRow[]): number[] {
  return [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
}

export function findRow(
  rows: PeriodRow[],
  year: number,
  month: number,
  split: Split,
): PeriodRow | undefined {
  return rows.find((r) => r.year === year && r.month === month && r.split === split);
}
