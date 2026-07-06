import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  omsExVat: z.number().nonnegative(),
  dbExVat: z.number(),
});

/** Edit a monthly budget target (ex-VAT). Overrides the default budget. */
export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldigt budget" }, { status: 400 });
  }
  const { year, month, omsExVat, dbExVat } = parsed.data;
  await getStore().setBudget(year, month, omsExVat, dbExVat);
  return NextResponse.json({ ok: true });
}
