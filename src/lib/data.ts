import { computeMetrics } from "./metrics";
import { periodId } from "./periods";
import { getStore } from "./store";
import type { PeriodRow } from "./view";

/** All stored periods, with metrics computed and notes attached (server only). */
export async function getAllRows(): Promise<PeriodRow[]> {
  const store = getStore();
  const [snapshots, notes] = await Promise.all([store.listSnapshots(), store.listNotes()]);
  const noteMap = new Map(notes.map((n) => [periodId(n), n.text] as const));

  return snapshots
    .map((s) => ({
      year: s.year,
      month: s.month,
      split: s.split,
      metrics: computeMetrics(s),
      note: noteMap.get(periodId(s)) ?? null,
      capturedAt: s.capturedAt,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month || (a.split === "half" ? -1 : 1));
}

export type { PeriodRow } from "./view";
