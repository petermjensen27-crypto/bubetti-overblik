import { NextResponse } from "next/server";
import { z } from "zod";
import { backfill, ingestCurrent, ingestOne, runScheduled } from "@/lib/ingest";
import { computeMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const periodShape = {
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  split: z.enum(["half", "full"]),
};
const periodSchema = z.object(periodShape);

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("one"), ...periodShape }),
  z.object({ action: z.literal("due") }),
  z.object({ action: z.literal("current") }),
  z.object({
    action: z.literal("backfill"),
    from: periodSchema,
    to: periodSchema,
  }),
]);

/** Manual ingestion trigger (protected by the proxy). */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørgsel", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  try {
    if (body.action === "one") {
      const snapshot = await ingestOne(body, "manual");
      return NextResponse.json({ snapshot, metrics: computeMetrics(snapshot) });
    }
    if (body.action === "due") {
      const ran = await runScheduled();
      return NextResponse.json({ ran });
    }
    if (body.action === "current") {
      const keys = await ingestCurrent();
      return NextResponse.json({ ok: true, refreshed: keys.length });
    }
    const result = await backfill(body.from, body.to);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
