import { CURRENCY, LOCALE } from "./config";

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
});

const currencyCompactFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const pctFmt = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ratioFmt = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, compact = false): string {
  return (compact ? currencyCompactFmt : currencyFmt).format(value);
}

/** Formats a fraction (0.4925) as a percentage string ("49,25 %"). */
export function formatPercent(fraction: number): string {
  return pctFmt.format(fraction);
}

/** Formats a plain ratio like MER/MPR ("10,08"). */
export function formatRatio(value: number): string {
  return ratioFmt.format(value);
}
