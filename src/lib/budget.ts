import { getStore } from "./store";

/** Monthly budget target, ex-VAT (matches the P&L budget sheet's basis). */
export interface BudgetTarget {
  omsExVat: number;
  dbExVat: number;
}

export function budgetKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Default budget seeded from the FY2026 P&L (Oct 2025 – Sep 2026), ex-VAT.
 * User edits are stored as overrides and take precedence (see getBudgetMap).
 */
export const DEFAULT_BUDGET: Record<string, BudgetTarget> = {
  "2025-10": { omsExVat: 766217, dbExVat: 426296 },
  "2025-11": { omsExVat: 771888, dbExVat: 496391 },
  "2025-12": { omsExVat: 788877, dbExVat: 421451 },
  "2026-01": { omsExVat: 536825, dbExVat: 263599 },
  "2026-02": { omsExVat: 511403, dbExVat: 181475 },
  "2026-03": { omsExVat: 453416, dbExVat: 216882 },
  "2026-04": { omsExVat: 455652, dbExVat: 234459 },
  "2026-05": { omsExVat: 541949, dbExVat: 312425 },
  "2026-06": { omsExVat: 361230, dbExVat: 208284 },
  "2026-07": { omsExVat: 505390, dbExVat: 264561 },
  "2026-08": { omsExVat: 514141, dbExVat: 235899 },
  "2026-09": { omsExVat: 585142, dbExVat: 308889 },
};

/** Default budget merged with any stored user overrides (server-only). */
export async function getBudgetMap(): Promise<Record<string, BudgetTarget>> {
  const overrides = await getStore().listBudgetOverrides();
  const map: Record<string, BudgetTarget> = { ...DEFAULT_BUDGET };
  for (const o of overrides) map[budgetKey(o.year, o.month)] = { omsExVat: o.omsExVat, dbExVat: o.dbExVat };
  return map;
}

export function budgetFor(
  map: Record<string, BudgetTarget>,
  year: number,
  month: number,
): BudgetTarget | null {
  return map[budgetKey(year, month)] ?? null;
}
