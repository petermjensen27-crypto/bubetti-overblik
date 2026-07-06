import { TIMEZONE } from "./config";
import { daysInMonth } from "./periods";
import {
  shopifyConfigured,
  shopifyDaily,
  shopifyTotal,
  type SalesMetric,
} from "./integrations/shopify";
import { toZonedTime } from "date-fns-tz";

/** Projection for one metric: midpoint plus a confidence range (all ex-VAT). */
export interface MetricForecast {
  mid: number;
  lo: number;
  hi: number;
}

export interface Forecast {
  year: number;
  month: number;
  /** Last complete day of the month used as the MTD cutoff. */
  throughDay: number;
  daysInMonth: number;
  /** Smoothed YoY growth applied to the remaining days (fraction, e.g. 0.23). */
  growth: number;
  /** Net sales month-to-date, ex-VAT. */
  mtdNet: number;
  netSales: MetricForecast;
  grossProfit: MetricForecast;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function prevMonth(y: number, m: number): { y: number; m: number } {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}

function sumRange(byDay: Record<number, number>, from: number, to: number): number {
  let s = 0;
  for (let d = from; d <= to; d++) s += byDay[d] || 0;
  return s;
}

/**
 * Smoothed YoY growth = recency-weighted mean of the last 3 completed months'
 * year-over-year ratios. Robust to a single spiky month. Returns { mid, lo, hi }.
 */
async function smoothedGrowth(
  year: number,
  month: number,
  metric: SalesMetric,
): Promise<{ mid: number; lo: number; hi: number }> {
  const ratios: number[] = [];
  let cur = prevMonth(year, month);
  for (let i = 0; i < 3; i++) {
    const now = await shopifyTotal(metric, iso(cur.y, cur.m, 1), iso(cur.y, cur.m, daysInMonth(cur.y, cur.m)));
    const prevY = cur.y - 1;
    const prev = await shopifyTotal(metric, iso(prevY, cur.m, 1), iso(prevY, cur.m, daysInMonth(prevY, cur.m)));
    if (prev > 0 && now > 0) ratios.push(now / prev);
    cur = prevMonth(cur.y, cur.m);
  }
  if (ratios.length === 0) return { mid: 1, lo: 1, hi: 1 };
  // Recency weight: most recent (ratios[0]) heaviest.
  const weights = ratios.map((_, i) => ratios.length - i);
  const totW = weights.reduce((a, b) => a + b, 0);
  const mid = ratios.reduce((s, r, i) => s + r * weights[i], 0) / totW;
  return { mid, lo: Math.min(...ratios), hi: Math.max(...ratios) };
}

async function projectMetric(
  year: number,
  month: number,
  metric: SalesMetric,
  throughDay: number,
): Promise<MetricForecast & { mtd: number }> {
  const mtd = sumRange(await shopifyDaily(metric, iso(year, month, 1), iso(year, month, throughDay)), 1, throughDay);

  // Prior-year revenue for the remaining days, recency-weighted.
  const priorYears = [year - 2, year - 1];
  const rem: number[] = [];
  for (const py of priorYears) {
    const pyDays = daysInMonth(py, month);
    const byDay = await shopifyDaily(metric, iso(py, month, 1), iso(py, month, pyDays));
    if (sumRange(byDay, 1, pyDays) <= 0) continue;
    rem.push(sumRange(byDay, throughDay + 1, pyDays));
  }
  const priorRemaining =
    rem.length === 0
      ? 0
      : rem.reduce((s, v, i) => s + v * (i + 1), 0) / rem.reduce((s, _, i) => s + (i + 1), 0);

  const g = await smoothedGrowth(year, month, metric);
  return {
    mtd,
    mid: mtd + priorRemaining * g.mid,
    lo: mtd + priorRemaining * g.lo,
    hi: mtd + priorRemaining * g.hi,
  };
}

/**
 * Robust month-end forecast for net sales and gross profit (ex-VAT):
 * actual month-to-date + prior-years' remaining-day revenue × smoothed YoY growth.
 * Returns null if Shopify isn't configured. Intended for the in-progress month.
 */
export async function robustForecast(now: Date = new Date()): Promise<Forecast | null> {
  if (!shopifyConfigured()) return null;

  const local = toZonedTime(now, TIMEZONE);
  const year = local.getFullYear();
  const month = local.getMonth() + 1;
  const days = daysInMonth(year, month);
  // Forecast from the last complete day (yesterday); nothing to project on the 1st.
  const throughDay = Math.min(local.getDate() - 1, days);
  if (throughDay < 1) return null;

  const net = await projectMetric(year, month, "net_sales", throughDay);
  const gp = await projectMetric(year, month, "gross_profit", throughDay);
  const growth = await smoothedGrowth(year, month, "net_sales");

  return {
    year,
    month,
    throughDay,
    daysInMonth: days,
    growth: growth.mid - 1,
    mtdNet: net.mtd,
    netSales: { mid: net.mid, lo: net.lo, hi: net.hi },
    grossProfit: { mid: gp.mid, lo: gp.lo, hi: gp.hi },
  };
}
