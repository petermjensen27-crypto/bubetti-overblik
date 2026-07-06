"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Manual data controls: pull today's due snapshot, or backfill a range. */
export function AdminActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function post(body: unknown, label: string) {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage(res.ok ? okMessage(label, data) : `Fejl: ${data.error ?? res.status}`);
      if (res.ok) router.refresh();
    } catch (err) {
      setMessage(`Fejl: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  function okMessage(label: string, data: Record<string, unknown>): string {
    if (label === "backfill") return `Backfill færdig: ${data.ok} hentet, ${data.failed} fejlede`;
    return "Kørsel færdig";
  }

  const now = new Date();
  // Shopify analytics data begins September 2023.
  const from = { year: 2023, month: 9, split: "half" as const };
  const to = { year: now.getFullYear(), month: now.getMonth() + 1, split: "full" as const };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => post({ action: "due" }, "due")} disabled={busy !== null} className="btn-outline disabled:opacity-50">
        {busy === "due" ? "Henter…" : "Kør dagens pull"}
      </button>
      <button onClick={() => post({ action: "backfill", from, to }, "backfill")} disabled={busy !== null} className="btn-outline disabled:opacity-50">
        {busy === "backfill" ? "Henter historik…" : "Backfill historik"}
      </button>
      {message && <span className="text-sm text-[var(--muted)]">{message}</span>}
    </div>
  );
}
