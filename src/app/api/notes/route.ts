import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  split: z.enum(["half", "full"]),
  text: z.string().max(2000),
});

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig note" }, { status: 400 });
  }
  const { year, month, split, text } = parsed.data;
  await getStore().setNote(year, month, split, text);
  return NextResponse.json({ ok: true });
}
