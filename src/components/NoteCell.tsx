"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Split } from "@/lib/periods";

export function NoteCell({
  year,
  month,
  split,
  initial,
}: {
  year: number;
  month: number;
  split: Split;
  initial: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, split, text }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-48 rounded border border-slate-300 px-2 py-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {saving ? "…" : "Gem"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="max-w-56 truncate text-left text-xs text-slate-500 hover:text-slate-900"
      title={text || "Tilføj note"}
    >
      {text || <span className="italic text-slate-300">Tilføj note…</span>}
    </button>
  );
}
