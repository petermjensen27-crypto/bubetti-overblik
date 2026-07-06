import { toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "./config";

export type Split = "half" | "full";

export interface PeriodKey {
  year: number;
  /** 1–12 */
  month: number;
  split: Split;
}

/** Inclusive calendar-date bounds (YYYY-MM-DD) for a period. */
export interface PeriodBounds {
  /** First day covered (always the 1st of the month). */
  start: string;
  /** Last day covered: the 15th for a half month, month-end for a full month. */
  end: string;
}

function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Number of days in a given month (month is 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function periodBounds({ year, month, split }: PeriodKey): PeriodBounds {
  const lastDay = split === "half" ? 15 : daysInMonth(year, month);
  return { start: iso(year, month, 1), end: iso(year, month, lastDay) };
}

const MONTHS_DA = [
  "Januar",
  "Februar",
  "Marts",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
];

export function monthName(month: number): string {
  return MONTHS_DA[month - 1] ?? String(month);
}

export function periodLabel(key: PeriodKey): string {
  const split = key.split === "half" ? "Halv måned" : "Hel måned";
  return `${monthName(key.month)} ${key.year} – ${split}`;
}

/** Stable string key used for maps and storage lookups. */
export function periodId({ year, month, split }: PeriodKey): string {
  return `${year}-${String(month).padStart(2, "0")}-${split}`;
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** The current calendar month, evaluated in the business timezone. */
export function currentMonth(now: Date = new Date()): { year: number; month: number } {
  const local = toZonedTime(now, TIMEZONE);
  return { year: local.getFullYear(), month: local.getMonth() + 1 };
}

/**
 * Given a moment in time, returns the snapshot that is "due" that day, or null.
 *
 * The scheduled job runs daily; it acts only on two days (evaluated in the
 * business timezone):
 *  - the 16th  -> half-month snapshot for the *current* month (1st–15th complete)
 *  - the 1st   -> full-month snapshot for the *previous* month (now complete)
 */
export function dueSnapshot(now: Date = new Date()): PeriodKey | null {
  const local = toZonedTime(now, TIMEZONE);
  const day = local.getDate();
  const year = local.getFullYear();
  const month = local.getMonth() + 1;

  if (day === 16) return { year, month, split: "half" };
  if (day === 1) {
    const prev = previousMonth(year, month);
    return { ...prev, split: "full" };
  }
  return null;
}
