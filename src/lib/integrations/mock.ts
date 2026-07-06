import { daysInMonth, type Split } from "../periods";
import type { RevenueResult, RevenueSource, SpendSource } from "./types";

/**
 * Deterministic mock data. Used until real API credentials are provisioned so
 * the whole app (dashboard, graphs, cron) is fully exercisable end-to-end.
 *
 * The June rows are the *actual* figures from the reference sheet, so the
 * calibration step (app output vs. sheet) can be demonstrated before any real
 * integration exists. All other months are synthesised deterministically.
 */

const GOOGLE_SHARE = 0.55;

interface Seed {
  rev: number; // revenue incl. VAT
  cogs: number;
  spend: number; // total ad spend
}

// Ground truth from the sheet's June tab (2024–2026, half + full month).
const SEED: Record<string, Seed> = {
  "2024-6-half": { rev: 221585, cogs: 89966, spend: 21972 },
  "2024-6-full": { rev: 380357, cogs: 153797.6, spend: 38764 },
  "2025-6-half": { rev: 196724, cogs: 76173.2, spend: 19415 },
  "2025-6-full": { rev: 405423, cogs: 158418.4, spend: 42101 },
  "2026-6-half": { rev: 225380, cogs: 85338, spend: 29077 },
  "2026-6-full": { rev: 532067.3, cogs: 212439.64, spend: 55836 },
};

function seedKey(year: number, month: number, split: Split): string {
  return `${year}-${month}-${split}`;
}

/** Deterministic 0..1 value from a string. */
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// Rough seasonality multipliers by month (Nov/Dec peak, summer dip).
const SEASON = [0.9, 0.85, 0.95, 1.0, 1.05, 1.0, 0.9, 0.85, 1.0, 1.1, 1.3, 1.35];

function synthesise(year: number, month: number, split: Split): Seed {
  const base = 380000; // ~2024 full-month baseline (matches June scale)
  const yoyGrowth = Math.pow(1.08, year - 2024);
  const season = SEASON[month - 1];
  const noise = 0.9 + hash01(seedKey(year, month, split)) * 0.2; // ±10%
  const fullRev = base * yoyGrowth * season * noise;

  // Half month ~ proportion of the month elapsed, slightly front-loaded.
  const rev = split === "half" ? fullRev * (15 / daysInMonth(year, month)) * 0.98 : fullRev;

  const exVat = rev / 1.25;
  const cogs = exVat * (0.5 + hash01("cogs" + seedKey(year, month, split)) * 0.03); // ~50–53%
  const mer = 9 + hash01("mer" + seedKey(year, month, split)) * 2; // MER 9–11
  const spend = rev / mer;

  return { rev: round2(rev), cogs: round2(cogs), spend: round2(spend) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function figuresFor(year: number, month: number, split: Split): Seed {
  return SEED[seedKey(year, month, split)] ?? synthesise(year, month, split);
}

function parseRange(start: string, end: string): { year: number; month: number; split: Split } {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const split: Split = end.slice(8, 10) === "15" ? "half" : "full";
  return { year, month, split };
}

export const mockRevenueSource: RevenueSource = {
  name: "Shopify (mock)",
  async getRevenue(start: string, end: string): Promise<RevenueResult> {
    const { year, month, split } = parseRange(start, end);
    const s = figuresFor(year, month, split);
    // Mock treats seed "rev" as incl-VAT; derive net sales + a simple gross profit.
    const netSales = round2(s.rev / 1.25);
    return { netSales, cogs: s.cogs, grossProfit: round2(netSales - s.cogs) };
  },
};

function mockSpendSource(key: "google" | "meta", share: number): SpendSource {
  return {
    key,
    name: key === "google" ? "Google Ads (mock)" : "Meta Ads (mock)",
    async getSpend(start: string, end: string): Promise<number> {
      const { year, month, split } = parseRange(start, end);
      return round2(figuresFor(year, month, split).spend * share);
    },
  };
}

export const mockGoogleSource = mockSpendSource("google", GOOGLE_SHARE);
export const mockMetaSource = mockSpendSource("meta", 1 - GOOGLE_SHARE);
