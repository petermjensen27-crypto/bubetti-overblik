"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { LedgerAccount } from "@/lib/integrations/economic";

export function LedgerView() {
  const [state, setState] = useState<"loading" | "ready" | "unconfigured" | "error">("loading");
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setState("error"); return; }
        if (!d.configured) { setState("unconfigured"); return; }
        setAccounts(d.accounts ?? []);
        setState("ready");
      })
      .catch((e) => { setError(String(e)); setState("error"); });
  }, []);

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="context">
        <h2>Saldobalance — resultatkonti</h2>
        <span className="note-chip">e-conomic</span>
      </div>

      {state === "loading" && <p className="vatlegend">Henter saldobalance fra e-conomic…</p>}

      {state === "unconfigured" && (
        <div className="rounded-2xl border border-dashed border-[var(--hair-strong)] bg-white p-8 text-center">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>e-conomic er ikke forbundet endnu</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tilføj <code>ECONOMIC_APP_SECRET_TOKEN</code> og <code>ECONOMIC_AGREEMENT_GRANT_TOKEN</code> for at hente saldobalancen.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-lg border border-[var(--neg)] bg-[var(--neg-bg)] px-4 py-2 text-sm" style={{ color: "var(--neg)" }}>
          Kunne ikke hente fra e-conomic: {error}
        </div>
      )}

      {state === "ready" && (
        <div className="tablewrap">
          <div className="thead">
            <h3>Resultatkonti ({accounts.length})</h3>
            <span>Indeværende regnskabsår · beløb i DKK (indtægter vises negativt / kredit)</span>
          </div>
          <div className="scroll">
            <table className="ll-table">
              <thead>
                <tr><th>Konto</th><th>Navn</th><th>Saldo</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.number}>
                    <td className="per">{a.number}</td>
                    <td style={{ textAlign: "left" }}>{a.name}</td>
                    <td className="tabular-nums">{formatMoney(a.balance)}</td>
                  </tr>
                ))}
                <tr className="full">
                  <td className="per" colSpan={2} style={{ textAlign: "left", fontWeight: 650 }}>Resultat i alt</td>
                  <td className="strong">{formatMoney(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
