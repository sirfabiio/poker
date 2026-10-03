"use client";

import { useState, useTransition } from "react";
import { addSessionPlayers } from "@/lib/actions/sessions";
import { buttonClass } from "@/components/ui/Button";
import { useSheet } from "@/components/ui/Sheet";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PlayerPicker, type PickPlayer } from "./PlayerPicker";

/** Juntar jogadores a uma sessão em aberto (cada um entra com o buy-in por defeito). */
export function AddPlayersForm({ sessionId, players: initial }: { sessionId: string; players: PickPlayer[] }) {
  const [players, setPlayers] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useSheet();
  const online = useOnline();

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="space-y-4">
      {players.length === 0 && <p className="text-sm text-ivory/80">Toda a gente ativa já está nesta sessão.</p>}
      <PlayerPicker
        players={players}
        selected={selected}
        onToggle={toggle}
        onAdded={(p) => {
          setPlayers((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p]));
          toggle(p.id, true);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !online || selected.size === 0}
        className={buttonClass("primary", "lg", "w-full")}
        onClick={() =>
          start(async () => {
            const r = await addSessionPlayers(sessionId, [...selected]);
            if (!r.ok) return setError(r.error);
            setSelected(new Set());
            setError(null);
            sheet.close();
          })
        }
      >
        {pending ? "A juntar…" : `Juntar à mesa${selected.size ? ` (${selected.size})` : ""}`}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
