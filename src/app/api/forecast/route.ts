import { NextResponse } from "next/server";
import { robustForecast } from "@/lib/forecast";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Robust month-end forecast for the current (in-progress) month. */
export async function GET() {
  try {
    const forecast = await robustForecast();
    return NextResponse.json({ forecast });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
