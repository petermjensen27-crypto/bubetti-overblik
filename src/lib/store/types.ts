import type { Split } from "../periods";

/** One persisted data point: raw pulled figures for a single period. */
export interface StoredSnapshot {
  year: number;
  month: number;
  split: Split;
  periodStart: string;
  periodEnd: string;
  /** Shopify net sales, excl. VAT (DKK). */
  netSales: number;
  cogs: number;
  /** Shopify gross profit (DKK). */
  grossProfit: number;
  spendGoogle: number;
  spendMeta: number;
  /** ISO timestamp of when this data was pulled. */
  capturedAt: string;
  /** Id of the ingestion run that produced it. */
  runId: string;
}

export interface Note {
  year: number;
  month: number;
  split: Split;
  text: string;
  updatedAt: string;
}

export type RunStatus = "running" | "success" | "error";
export type RunKind = "scheduled" | "manual" | "backfill";

export interface IngestionRun {
  id: string;
  kind: RunKind;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  /** Human summary, e.g. "Juni 2026 – Hel måned" or error message. */
  detail: string | null;
}

/** A user edit to the monthly budget target (ex-VAT). Overrides the default. */
export interface BudgetOverride {
  year: number;
  month: number;
  omsExVat: number;
  dbExVat: number;
  updatedAt: string;
}

export interface Store {
  upsertSnapshot(snapshot: StoredSnapshot): Promise<void>;
  getSnapshot(year: number, month: number, split: Split): Promise<StoredSnapshot | null>;
  listSnapshots(): Promise<StoredSnapshot[]>;

  getNote(year: number, month: number, split: Split): Promise<Note | null>;
  setNote(year: number, month: number, split: Split, text: string): Promise<void>;
  listNotes(): Promise<Note[]>;

  createRun(run: IngestionRun): Promise<void>;
  finishRun(id: string, status: RunStatus, detail: string | null): Promise<void>;
  listRuns(limit?: number): Promise<IngestionRun[]>;

  listBudgetOverrides(): Promise<BudgetOverride[]>;
  setBudget(year: number, month: number, omsExVat: number, dbExVat: number): Promise<void>;
}
