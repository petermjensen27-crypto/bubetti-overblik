import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";

describe("computeMetrics", () => {
  it("uses Shopify gross profit directly for DB (not netSales − cogs)", () => {
    // Gross profit only counts items with a recorded cost, so it is passed in
    // explicitly and must not be recomputed from netSales − cogs.
    const m = computeMetrics({
      year: 2026, month: 6, split: "full",
      netSales: 424626.28, cogs: 205739.88, grossProfit: 213214.2,
      spendGoogle: 21822, spendMeta: 34028,
    });
    expect(m.db).toBeCloseTo(213214.2, 2);
    expect(m.db).not.toBeCloseTo(424626.28 - 205739.88, 0); // ≠ netSales − cogs
  });

  it("derives the surrounding metrics correctly", () => {
    const m = computeMetrics({
      year: 2025, month: 1, split: "full",
      netSales: 100000, cogs: 40000, grossProfit: 55000,
      spendGoogle: 6000, spendMeta: 4000,
    });
    expect(m.revenueInclVat).toBeCloseTo(125000, 6); // ×1.25 VAT
    expect(m.spend).toBe(10000);
    expect(m.contributionMargin).toBe(45000); // db − spend
    expect(m.dbPct).toBeCloseTo(0.55, 6); // gross profit / net sales
    expect(m.mer).toBeCloseTo(12.5, 6); // revenue incl VAT / spend
    expect(m.mpr).toBeCloseTo(5.5, 6); // db / spend
  });

  it("handles zero spend without dividing by zero", () => {
    const m = computeMetrics({
      year: 2026, month: 1, split: "full",
      netSales: 100000, cogs: 40000, grossProfit: 60000,
      spendGoogle: 0, spendMeta: 0,
    });
    expect(m.mer).toBe(0);
    expect(m.mpr).toBe(0);
  });
});
