/**
 * e-conomic (Danish accounting) — profit & loss account balances.
 *
 * Auth uses two headers: the app's secret token and the customer agreement's
 * grant token (see docs/CREDENTIALS.md for how to obtain them).
 *
 * Required env:
 *   ECONOMIC_APP_SECRET_TOKEN
 *   ECONOMIC_AGREEMENT_GRANT_TOKEN
 */

const BASE = "https://restapi.e-conomic.com";

export function economicConfigured(): boolean {
  return Boolean(process.env.ECONOMIC_APP_SECRET_TOKEN && process.env.ECONOMIC_AGREEMENT_GRANT_TOKEN);
}

/** One profit & loss ledger account with its current-year balance (DKK). */
export interface LedgerAccount {
  number: number;
  name: string;
  balance: number;
}

interface EcAccount {
  accountNumber: number;
  accountType: string;
  name: string;
  balance?: number;
}
interface EcAccountsPage {
  collection: EcAccount[];
  pagination?: { nextPage?: string };
}

/**
 * Fetches the chart of accounts and returns the profit & loss accounts
 * (accountType "profitAndLoss") with their balances, ordered by account number.
 */
export async function getProfitLossAccounts(): Promise<LedgerAccount[]> {
  if (!economicConfigured()) throw new Error("e-conomic is not configured");
  const headers = {
    "X-AppSecretToken": process.env.ECONOMIC_APP_SECRET_TOKEN!,
    "X-AgreementGrantToken": process.env.ECONOMIC_AGREEMENT_GRANT_TOKEN!,
    "Content-Type": "application/json",
  };

  const out: LedgerAccount[] = [];
  let url: string | undefined = `${BASE}/accounts?pageSize=1000&skippages=0`;
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`e-conomic API ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as EcAccountsPage;
    for (const a of page.collection ?? []) {
      if (a.accountType === "profitAndLoss") {
        out.push({ number: a.accountNumber, name: a.name, balance: Number(a.balance ?? 0) });
      }
    }
    url = page.pagination?.nextPage;
  }
  return out.sort((a, b) => a.number - b.number);
}
