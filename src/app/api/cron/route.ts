import { NextResponse } from "next/server";
import { runScheduled } from "@/lib/ingest";
import { periodLabel } from "@/lib/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron target (Vercel Cron). Acts only on the 16th (half month) and the
 * 1st (previous full month). Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const ran = await runScheduled();
    return NextResponse.json({
      ran: ran ? periodLabel(ran) : null,
      message: ran ? "Snapshot hentet" : "Ingen snapshot planlagt i dag",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
