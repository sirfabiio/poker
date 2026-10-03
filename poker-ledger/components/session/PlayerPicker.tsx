"use client";

import { useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { addPlayer } from "@/lib/actions/players";
import { useOnline } from "@/lib/use-online";

export type PickPlayer = { id: string; name: string; avatarColor: string };

/** Seleção múltipla de perfis ativos + "+ Adicionar pessoa nova" no fim. */
export function PlayerPicker({
  players,
  selected,
  onToggle,
  onAdded,
}: {
  players: PickPlayer[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onAdded: (p: PickPlayer) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ivory/80">Quem joga?</legend>
      <ul className="max-h-[40dvh] space-y-1.5 overflow-y-auto overscroll-contain">
        {players.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-ink/30 px-3 py-1.5">
              <Chip name={p.name} color={p.avatarColor} size="sm" />
              <span className="flex-1 truncate">{p.name}</span>
              <input
                type="checkbox"
                className="size-5 accent-[#D4AF37]"
                checked={selected.has(p.id)}
                onChange={(e) => onToggle(p.id, e.target.checked)}
              />
            </label>
          </li>
        ))}
      </ul>
      <AddPersonInline
        onAdded={onAdded}
        onSelectExisting={(p) => {
          if (!players.some((x) => x.id === p.id)) onAdded(p);
          else onToggle(p.id, true);
        }}
      />
    </fieldset>
  );
}

function AddPersonInline({
  onAdded,
  onSelectExisting,
}: {
  onAdded: (p: PickPlayer) => void;
  onSelectExisting: (p: PickPlayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<(PickPlayer & { active: boolean }) | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm", "mt-2 px-0")}>
        + Adicionar pessoa nova
      </button>
    );
  }

  const submit = () =>
    start(async () => {
      setError(null);
      setExisting(null);
      const r = await addPlayer(name);
      if (r.ok) {
        onAdded(r.player);
        setName("");
        setOpen(false);
      } else {
        setError(r.error);
        setExisting(r.existing ?? null);
      }
    });

  return (
    <div className="mt-3 rounded-2xl bg-ink/30 p-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome da pessoa nova</span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            minLength={2}
            maxLength={30}
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-ink/40 px-3"
          />
          <button type="button" onClick={submit} disabled={pending || !online || name.trim().length < 2} className={buttonClass("secondary", "md")}>
            {pending ? "…" : "Adicionar"}
          </button>
        </div>
      </label>
      {error && (
        <div role="alert" className="mt-2 text-sm">
          <p className="text-loss-soft">{error}</p>
          {existing?.active && (
            <button
              type="button"
              className={buttonClass("secondary", "sm", "mt-2")}
              onClick={() => {
                onSelectExisting(existing);
                setOpen(false);
                setError(null);
                setName("");
              }}
            >
              Selecionar {existing.name}
            </button>
          )}
          {existing && !existing.active && <p className="mt-1 text-ivory/80">Esse perfil está desativado; o admin pode reativá-lo.</p>}
        </div>
      )}
    </div>
  );
}
