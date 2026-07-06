import { promises as fs } from "node:fs";
import path from "node:path";
import type { Split } from "../periods";
import { periodId } from "../periods";
import type {
  BudgetOverride,
  IngestionRun,
  Note,
  RunStatus,
  Store,
  StoredSnapshot,
} from "./types";

/**
 * File-backed store for local development. Data volume is tiny (a few rows per
 * month), so a single JSON file is more than adequate. In production on Vercel
 * the filesystem is ephemeral/read-only, so the Postgres store is used instead.
 */
interface DbShape {
  snapshots: Record<string, StoredSnapshot>;
  notes: Record<string, Note>;
  runs: IngestionRun[];
  budgets: Record<string, BudgetOverride>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY: DbShape = { snapshots: {}, notes: {}, runs: [], budgets: {} };

async function read(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as DbShape) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function write(db: DbShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export class JsonStore implements Store {
  async upsertSnapshot(snapshot: StoredSnapshot): Promise<void> {
    const db = await read();
    db.snapshots[periodId(snapshot)] = snapshot;
    await write(db);
  }

  async getSnapshot(year: number, month: number, split: Split) {
    const db = await read();
    return db.snapshots[periodId({ year, month, split })] ?? null;
  }

  async listSnapshots(): Promise<StoredSnapshot[]> {
    const db = await read();
    return Object.values(db.snapshots);
  }

  async getNote(year: number, month: number, split: Split): Promise<Note | null> {
    const db = await read();
    return db.notes[periodId({ year, month, split })] ?? null;
  }

  async setNote(year: number, month: number, split: Split, text: string): Promise<void> {
    const db = await read();
    db.notes[periodId({ year, month, split })] = {
      year,
      month,
      split,
      text,
      updatedAt: new Date().toISOString(),
    };
    await write(db);
  }

  async listNotes(): Promise<Note[]> {
    const db = await read();
    return Object.values(db.notes);
  }

  async createRun(run: IngestionRun): Promise<void> {
    const db = await read();
    db.runs.unshift(run);
    await write(db);
  }

  async finishRun(id: string, status: RunStatus, detail: string | null): Promise<void> {
    const db = await read();
    const run = db.runs.find((r) => r.id === id);
    if (run) {
      run.status = status;
      run.detail = detail;
      run.finishedAt = new Date().toISOString();
      await write(db);
    }
  }

  async listRuns(limit = 50): Promise<IngestionRun[]> {
    const db = await read();
    return db.runs.slice(0, limit);
  }

  async listBudgetOverrides(): Promise<BudgetOverride[]> {
    const db = await read();
    return Object.values(db.budgets);
  }

  async setBudget(year: number, month: number, omsExVat: number, dbExVat: number): Promise<void> {
    const db = await read();
    db.budgets[`${year}-${month}`] = { year, month, omsExVat, dbExVat, updatedAt: new Date().toISOString() };
    await write(db);
  }
}
