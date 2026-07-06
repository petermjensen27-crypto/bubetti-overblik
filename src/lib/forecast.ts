import { TIMEZONE } from "./config";
import { daysInMonth } from "./periods";
import {
  shopifyConfigured,
  shopifyDaily,
  shopifyTotal,
  type SalesMetric,
} from "./integrations/shopify";
import { googleAdsConfigured, googleAdsSource, googleDailySpend } from "./integrations/google-ads";
import { metaConfigured, metaSource, metaDailySpend } from "./integrations/meta";
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
  /** Ad spend (Google + Meta). Present only when a spend source is configured. */
  spend?: MetricForecast;
  /** Contribution margin = gross profit − spend. Present when spend is available. */
  contributionMargin?: MetricForecast;
}

type DailyFn = (start: string, end: string) => Promise<Record<number, number>>;
type TotalFn = (start: string, end: string) => Promise<number>;

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
 * year-over-year ratios; range = min/max of those ratios.
 */
async function smoothedGrowth(
  year: number,
  month: number,
  totalFn: TotalFn,
): Promise<{ mid: number; lo: number; hi: number }> {
  const ratios: number[] = [];
  let cur = prevMonth(year, month);
  for (let i = 0; i < 3; i++) {
    const now = await totalFn(iso(cur.y, cur.m, 1), iso(cur.y, cur.m, daysInMonth(cur.y, cur.m)));
    const py = cur.y - 1;
    const prev = await totalFn(iso(py, cur.m, 1), iso(py, cur.m, daysInMonth(py, cur.m)));
    if (prev > 0 && now > 0) ratios.push(now / prev);
    cur = prevMonth(cur.y, cur.m);
  }
  if (ratios.length === 0) return { mid: 1, lo: 1, hi: 1 };
  const weights = ratios.map((_, i) => ratios.length - i); // most recent heaviest
  const totW = weights.reduce((a, b) => a + b, 0);
  const mid = ratios.reduce((s, r, i) => s + r * weights[i], 0) / totW;
  return { mid, lo: Math.min(...ratios), hi: Math.max(...ratios) };
}

/** actual month-to-date + prior-years' remaining-day total × smoothed YoY growth. */
async function project(
  year: number,
  month: number,
  throughDay: number,
  dailyFn: DailyFn,
  totalFn: TotalFn,
): Promise<MetricForecast & { mtd: number }> {
  const mtd = sumRange(await dailyFn(iso(year, month, 1), iso(year, month, throughDay)), 1, throughDay);

  const rem: number[] = [];
  for (const py of [year - 2, year - 1]) {
    const pyDays = daysInMonth(py, month);
    const byDay = await dailyFn(iso(py, month, 1), iso(py, month, pyDays));
    if (sumRange(byDay, 1, pyDays) <= 0) continue;
    rem.push(sumRange(byDay, throughDay + 1, pyDays));
  }
  const priorRemaining =
    rem.length === 0
      ? 0
      : rem.reduce((s, v, i) => s + v * (i + 1), 0) / rem.reduce((s, _, i) => s + (i + 1), 0);

  const g = await smoothedGrowth(year, month, totalFn);
  return {
    mtd,
    mid: mtd + priorRemaining * g.mid,
    lo: mtd + priorRemaining * g.lo,
    hi: mtd + priorRemaining * g.hi,
  };
}

const shopifyDailyFn = (metric: SalesMetric): DailyFn => (s, e) => shopifyDaily(metric, s, e);
const shopifyTotalFn = (metric: SalesMetric): TotalFn => (s, e) => shopifyTotal(metric, s, e);

const spendConfigured = () => googleAdsConfigured() || metaConfigured();
const spendDaily: DailyFn = async (start, end) => {
  const [g, m] = await Promise.all([googleDailySpend(start, end), metaDailySpend(start, end)]);
  const out: Record<number, number> = { ...g };
  for (const [d, v] of Object.entries(m)) out[Number(d)] = (out[Number(d)] ?? 0) + v;
  return out;
};
const spendTotal: TotalFn = async (start, end) => {
  let t = 0;
  if (googleAdsConfigured()) t += await googleAdsSource.getSpend(start, end);
  if (metaConfigured()) t += await metaSource.getSpend(start, end);
  return t;
};

/**
 * Robust month-end forecast for the in-progress month (ex-VAT): net sales,
 * gross profit, ad spend, and contribution margin, each with a confidence range.
 * Returns null if Shopify isn't configured.
 */
export async function robustForecast(now: Date = new Date()): Promise<Forecast | null> {
  if (!shopifyConfigured()) return null;

  const local = toZonedTime(now, TIMEZONE);
  const year = local.getFullYear();
  const month = local.getMonth() + 1;
  const days = daysInMonth(year, month);
  const throughDay = Math.min(local.getDate() - 1, days); // last complete day
  if (throughDay < 1) return null;

  const net = await project(year, month, throughDay, shopifyDailyFn("net_sales"), shopifyTotalFn("net_sales"));
  const gp = await project(year, month, throughDay, shopifyDailyFn("gross_profit"), shopifyTotalFn("gross_profit"));
  const growth = await smoothedGrowth(year, month, shopifyTotalFn("net_sales"));

  let spend: MetricForecast | undefined;
  let contributionMargin: MetricForecast | undefined;
  if (spendConfigured()) {
    const s = await project(year, month, throughDay, spendDaily, spendTotal);
    spend = { mid: s.mid, lo: s.lo, hi: s.hi };
    // Best CM pairs high profit with low spend; worst pairs low profit with high spend.
    contributionMargin = { mid: gp.mid - s.mid, lo: gp.lo - s.hi, hi: gp.hi - s.lo };
  }

  return {
    year,
    month,
    throughDay,
    daysInMonth: days,
    growth: growth.mid - 1,
    mtdNet: net.mtd,
    netSales: { mid: net.mid, lo: net.lo, hi: net.hi },
    grossProfit: { mid: gp.mid, lo: gp.lo, hi: gp.hi },
    spend,
    contributionMargin,
  };
}
