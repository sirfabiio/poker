"use client";

import { useState, useTransition } from "react";
import { createSession } from "@/lib/actions/sessions";
import { parseEuros, centsToInput } from "@/lib/money";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PlayerPicker, type PickPlayer } from "./PlayerPicker";
import { MoneyInput } from "./MoneyInput";

export function NewSessionForm({
  players: initial,
  today,
  defaultBuyIn,
}: {
  players: PickPlayer[];
  today: string;
  defaultBuyIn: number;
}) {
  const [players, setPlayers] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const buyIn = parseEuros(String(f.get("buyIn") ?? ""));
        if (!buyIn) return setError("Indica um buy-in válido (ex.: 20 ou 12,50).");
        if (selected.size < 2) return setError("Escolhe pelo menos 2 jogadores.");
        setError(null);
        start(async () => {
          const r = await createSession({
            date: String(f.get("date")),
            defaultBuyIn: buyIn,
            playerIds: [...selected],
            notes: String(f.get("notes") ?? ""),
          });
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">Data</span>
          <input type="date" name="date" required defaultValue={today} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
        </label>
        <MoneyInput label="Buy-in por defeito" name="buyIn" defaultValue={centsToInput(defaultBuyIn)} required />
      </div>

      <PlayerPicker
        players={players}
        selected={selected}
        onToggle={toggle}
        onAdded={(p) => {
          setPlayers((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p]));
          toggle(p.id, true);
        }}
      />

      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Notas (opcional)</span>
        <input name="notes" maxLength={280} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>

      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "A criar…" : `Começar sessão${selected.size ? ` (${selected.size})` : ""}`}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
