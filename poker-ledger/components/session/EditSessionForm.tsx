"use client";

import { useState, useTransition } from "react";
import { updateSession } from "@/lib/actions/sessions";
import { centsToInput, parseEuros } from "@/lib/money";
import { buttonClass } from "@/components/ui/Button";
import { useSheet } from "@/components/ui/Sheet";
import { useOnline } from "@/lib/use-online";
import { MoneyInput } from "./MoneyInput";

export function EditSessionForm({
  sessionId,
  date,
  defaultBuyIn,
  notes,
}: {
  sessionId: string;
  date: string;
  defaultBuyIn: number;
  notes: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useSheet();
  const online = useOnline();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const buyIn = parseEuros(String(f.get("buyIn") ?? ""));
        if (!buyIn) return setError("Indica um buy-in válido.");
        start(async () => {
          const r = await updateSession(sessionId, { date: String(f.get("date")), defaultBuyIn: buyIn, notes: String(f.get("notes") ?? "") });
          if (!r.ok) return setError(r.error);
          setError(null);
          sheet.close();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">Data</span>
          <input type="date" name="date" required defaultValue={date} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
        </label>
        <MoneyInput label="Buy-in por defeito" name="buyIn" defaultValue={centsToInput(defaultBuyIn)} required />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Notas</span>
        <input name="notes" defaultValue={notes} maxLength={280} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      <p className="text-[13px] text-ivory/75">Mudar o buy-in por defeito não altera entradas já registadas.</p>
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A guardar…" : "Guardar"}
      </button>
    </form>
  );
}
