import { getRevenueSource, getSpendSources } from "./integrations";
import {
  daysInMonth,
  dueSnapshot,
  periodBounds,
  periodLabel,
  type PeriodKey,
  type Split,
} from "./periods";
import { getStore } from "./store";
import type { IngestionRun, RunKind, StoredSnapshot } from "./store";

/** Pulls all sources for one period and returns the raw snapshot (no persistence). */
export async function pullPeriod(key: PeriodKey, runId: string): Promise<StoredSnapshot> {
  const bounds = periodBounds(key);
  const revenueSource = getRevenueSource();
  const [google, meta] = getSpendSources();

  const [revenue, spendGoogle, spendMeta] = await Promise.all([
    revenueSource.getRevenue(bounds.start, bounds.end),
    google.getSpend(bounds.start, bounds.end),
    meta.getSpend(bounds.start, bounds.end),
  ]);

  return {
    year: key.year,
    month: key.month,
    split: key.split,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    netSales: revenue.netSales,
    cogs: revenue.cogs,
    grossProfit: revenue.grossProfit,
    spendGoogle,
    spendMeta,
    capturedAt: new Date().toISOString(),
    runId,
  };
}

function newRun(kind: RunKind): IngestionRun {
  return {
    id: crypto.randomUUID(),
    kind,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "running",
    detail: null,
  };
}

/** Ingests a single period, wrapped in a tracked run. */
export async function ingestOne(key: PeriodKey, kind: RunKind): Promise<StoredSnapshot> {
  const store = getStore();
  const run = newRun(kind);
  await store.createRun(run);
  try {
    const snapshot = await pullPeriod(key, run.id);
    await store.upsertSnapshot(snapshot);
    await store.finishRun(run.id, "success", periodLabel(key));
    return snapshot;
  } catch (err) {
    await store.finishRun(run.id, "error", `${periodLabel(key)}: ${errMsg(err)}`);
    throw err;
  }
}

/**
 * Runs the scheduled pull for the given day. Returns the ingested period, or
 * null if nothing is due today (the cron fires daily but only acts twice/month).
 */
export async function runScheduled(now: Date = new Date()): Promise<PeriodKey | null> {
  const due = dueSnapshot(now);
  if (!due) return null;
  await ingestOne(due, "scheduled");
  return due;
}

/** Every (year, month, split) from a start period up to and including an end period. */
export function periodsBetween(from: PeriodKey, to: PeriodKey): PeriodKey[] {
  const keys: PeriodKey[] = [];
  let y = from.year;
  let m = from.month;
  const splits: Split[] = ["half", "full"];
  while (y < to.year || (y === to.year && m <= to.month)) {
    for (const split of splits) keys.push({ year: y, month: m, split });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  // Drop the "full" of the end month if the requested end is a half snapshot.
  return keys.filter(
    (k) => !(k.year === to.year && k.month === to.month && to.split === "half" && k.split === "full"),
  );
}

/**
 * Backfills a range of periods under a single run. Continues past individual
 * failures and reports how many succeeded.
 */
export async function backfill(from: PeriodKey, to: PeriodKey): Promise<{ ok: number; failed: number }> {
  const store = getStore();
  const run = newRun("backfill");
  await store.createRun(run);

  const keys = periodsBetween(from, to);
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const key of keys) {
    try {
      const snapshot = await pullPeriod(key, run.id);
      await store.upsertSnapshot(snapshot);
      ok += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${periodLabel(key)}: ${errMsg(err)}`);
    }
  }

  const detail =
    `${ok} perioder hentet, ${failed} fejlede` +
    (errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : "");
  await store.finishRun(run.id, failed > 0 && ok === 0 ? "error" : "success", detail);
  return { ok, failed };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Re-export for callers that build ad-hoc period keys.
export { daysInMonth };
