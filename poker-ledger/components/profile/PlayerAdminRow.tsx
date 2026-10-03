"use client";

import { useState, useTransition } from "react";
import { renamePlayer, setPlayerActive } from "@/lib/actions/players";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { useOnline } from "@/lib/use-online";

export function PlayerAdminRow({ p }: { p: { id: string; name: string; avatarColor: string; active: boolean } }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Chip name={p.name} color={p.avatarColor} size="sm" />
        <span className={`min-w-0 flex-1 truncate ${p.active ? "" : "text-ivory/60 line-through"}`}>{p.name}</span>
        <button type="button" disabled={!online} onClick={() => setEditing((v) => !v)} className={buttonClass("secondary", "sm")}>
          Renomear
        </button>
        <button
          type="button"
          disabled={pending || !online}
          onClick={() =>
            start(async () => {
              const r = await setPlayerActive(p.id, !p.active);
              setError(r.ok ? null : r.error);
            })
          }
          className={buttonClass(p.active ? "danger" : "secondary", "sm")}
        >
          {p.active ? "Desativar" : "Reativar"}
        </button>
      </div>
      {editing && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "");
            start(async () => {
              const r = await renamePlayer(p.id, name);
              if (r.ok) setEditing(false);
              setError(r.ok ? null : r.error);
            });
          }}
        >
          <label className="sr-only" htmlFor={`rn-${p.id}`}>
            Novo nome de {p.name}
          </label>
          <input id={`rn-${p.id}`} name="name" defaultValue={p.name} minLength={2} maxLength={30} required className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-ink/40 px-3" />
          <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md")}>
            Guardar
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-loss-soft">
          {error}
        </p>
      )}
    </li>
  );
}
