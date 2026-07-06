import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Split } from "../periods";
import type {
  BudgetOverride,
  IngestionRun,
  Note,
  RunKind,
  RunStatus,
  Store,
  StoredSnapshot,
} from "./types";

/**
 * Postgres (Neon) store for production. Schema is created on first use so no
 * separate migration step is needed for such a small data model.
 */
export class PgStore implements Store {
  private sql: NeonQueryFunction<false, false>;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  private init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS snapshots (
            year            INT  NOT NULL,
            month           INT  NOT NULL,
            split           TEXT NOT NULL,
            period_start    DATE NOT NULL,
            period_end      DATE NOT NULL,
            net_sales       NUMERIC NOT NULL,
            cogs            NUMERIC NOT NULL,
            gross_profit    NUMERIC NOT NULL,
            spend_google    NUMERIC NOT NULL,
            spend_meta      NUMERIC NOT NULL,
            captured_at     TIMESTAMPTZ NOT NULL,
            run_id          TEXT NOT NULL,
            PRIMARY KEY (year, month, split)
          )`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS notes (
            year       INT  NOT NULL,
            month      INT  NOT NULL,
            split      TEXT NOT NULL,
            text       TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (year, month, split)
          )`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS ingestion_runs (
            id          TEXT PRIMARY KEY,
            kind        TEXT NOT NULL,
            started_at  TIMESTAMPTZ NOT NULL,
            finished_at TIMESTAMPTZ,
            status      TEXT NOT NULL,
            detail      TEXT
          )`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS budgets (
            year        INT NOT NULL,
            month       INT NOT NULL,
            oms_ex_vat  NUMERIC NOT NULL,
            db_ex_vat   NUMERIC NOT NULL,
            updated_at  TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (year, month)
          )`;
      })();
    }
    return this.ready;
  }

  async upsertSnapshot(s: StoredSnapshot): Promise<void> {
    await this.init();
    await this.sql`
      INSERT INTO snapshots
        (year, month, split, period_start, period_end, net_sales,
         cogs, gross_profit, spend_google, spend_meta, captured_at, run_id)
      VALUES
        (${s.year}, ${s.month}, ${s.split}, ${s.periodStart}, ${s.periodEnd},
         ${s.netSales}, ${s.cogs}, ${s.grossProfit}, ${s.spendGoogle}, ${s.spendMeta},
         ${s.capturedAt}, ${s.runId})
      ON CONFLICT (year, month, split) DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        net_sales = EXCLUDED.net_sales,
        cogs = EXCLUDED.cogs,
        gross_profit = EXCLUDED.gross_profit,
        spend_google = EXCLUDED.spend_google,
        spend_meta = EXCLUDED.spend_meta,
        captured_at = EXCLUDED.captured_at,
        run_id = EXCLUDED.run_id`;
  }

  async getSnapshot(year: number, month: number, split: Split) {
    await this.init();
    const rows = await this.sql`
      SELECT * FROM snapshots
      WHERE year = ${year} AND month = ${month} AND split = ${split}`;
    return rows.length ? mapSnapshot(rows[0]) : null;
  }

  async listSnapshots(): Promise<StoredSnapshot[]> {
    await this.init();
    const rows = await this.sql`
      SELECT * FROM snapshots ORDER BY year, month, split`;
    return rows.map(mapSnapshot);
  }

  async getNote(year: number, month: number, split: Split): Promise<Note | null> {
    await this.init();
    const rows = await this.sql`
      SELECT * FROM notes
      WHERE year = ${year} AND month = ${month} AND split = ${split}`;
    return rows.length ? mapNote(rows[0]) : null;
  }

  async setNote(year: number, month: number, split: Split, text: string): Promise<void> {
    await this.init();
    await this.sql`
      INSERT INTO notes (year, month, split, text, updated_at)
      VALUES (${year}, ${month}, ${split}, ${text}, now())
      ON CONFLICT (year, month, split) DO UPDATE SET
        text = EXCLUDED.text, updated_at = EXCLUDED.updated_at`;
  }

  async listNotes(): Promise<Note[]> {
    await this.init();
    const rows = await this.sql`SELECT * FROM notes`;
    return rows.map(mapNote);
  }

  async createRun(run: IngestionRun): Promise<void> {
    await this.init();
    await this.sql`
      INSERT INTO ingestion_runs (id, kind, started_at, finished_at, status, detail)
      VALUES (${run.id}, ${run.kind}, ${run.startedAt}, ${run.finishedAt},
              ${run.status}, ${run.detail})`;
  }

  async finishRun(id: string, status: RunStatus, detail: string | null): Promise<void> {
    await this.init();
    await this.sql`
      UPDATE ingestion_runs
      SET status = ${status}, detail = ${detail}, finished_at = now()
      WHERE id = ${id}`;
  }

  async listRuns(limit = 50): Promise<IngestionRun[]> {
    await this.init();
    const rows = await this.sql`
      SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT ${limit}`;
    return rows.map(mapRun);
  }

  async listBudgetOverrides(): Promise<BudgetOverride[]> {
    await this.init();
    const rows = await this.sql`SELECT * FROM budgets`;
    return rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      omsExVat: Number(r.oms_ex_vat),
      dbExVat: Number(r.db_ex_vat),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    }));
  }

  async setBudget(year: number, month: number, omsExVat: number, dbExVat: number): Promise<void> {
    await this.init();
    await this.sql`
      INSERT INTO budgets (year, month, oms_ex_vat, db_ex_vat, updated_at)
      VALUES (${year}, ${month}, ${omsExVat}, ${dbExVat}, now())
      ON CONFLICT (year, month) DO UPDATE SET
        oms_ex_vat = EXCLUDED.oms_ex_vat, db_ex_vat = EXCLUDED.db_ex_vat, updated_at = EXCLUDED.updated_at`;
  }
}

type Row = Record<string, unknown>;

function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function mapSnapshot(r: Row): StoredSnapshot {
  return {
    year: Number(r.year),
    month: Number(r.month),
    split: r.split as Split,
    periodStart: toDateStr(r.period_start),
    periodEnd: toDateStr(r.period_end),
    netSales: Number(r.net_sales),
    cogs: Number(r.cogs),
    grossProfit: Number(r.gross_profit),
    spendGoogle: Number(r.spend_google),
    spendMeta: Number(r.spend_meta),
    capturedAt: new Date(r.captured_at as string).toISOString(),
    runId: String(r.run_id),
  };
}

function mapNote(r: Row): Note {
  return {
    year: Number(r.year),
    month: Number(r.month),
    split: r.split as Split,
    text: String(r.text),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapRun(r: Row): IngestionRun {
  return {
    id: String(r.id),
    kind: r.kind as RunKind,
    startedAt: new Date(r.started_at as string).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
    status: r.status as RunStatus,
    detail: r.detail === null || r.detail === undefined ? null : String(r.detail),
  };
}
