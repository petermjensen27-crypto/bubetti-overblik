import { JsonStore } from "./json-store";
import { PgStore } from "./pg-store";
import type { Store } from "./types";

let cached: Store | null = null;

/**
 * Returns the active store. Uses Postgres/Neon when DATABASE_URL is set
 * (production / Vercel), otherwise a local JSON file for development.
 */
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  cached = url ? new PgStore(url) : new JsonStore();
  return cached;
}

export type { Store } from "./types";
export * from "./types";
