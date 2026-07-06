import { NextResponse } from "next/server";
import { economicConfigured, getProfitLossAccounts } from "@/lib/integrations/economic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** P&L ledger balances from e-conomic. */
export async function GET() {
  if (!economicConfigured()) {
    return NextResponse.json({ configured: false, accounts: [] });
  }
  try {
    const accounts = await getProfitLossAccounts();
    return NextResponse.json({ configured: true, accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ configured: true, error: message, accounts: [] }, { status: 500 });
  }
}
