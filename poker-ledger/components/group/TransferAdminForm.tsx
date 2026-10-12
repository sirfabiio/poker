"use client";

import { useState, useTransition } from "react";
import { transferAdmin } from "@/lib/actions/groups";
import { useSheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

type M = { id: string; name: string; avatarColor: string };

/** Passar o admin a outro membro (só admin; o servidor volta a verificar). */
export function TransferAdminForm({ members }: { members: M[] }) {
  const [chosen, setChosen] = useState<M | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const { close } = useSheet();
  return (
    <div className="space-y-4">
      <p className="text-sm text-ivory/90">Escolhe quem passa a ser o admin. Tu ficas membro normal deste grupo.</p>
      <fieldset>
        <legend className="sr-only">Novo admin</legend>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-ink/40 px-4 py-2 has-[:checked]:ring-2 has-[:checked]:ring-gold-soft">
                <input type="radio" name="newAdmin" value={m.id} className="size-5 accent-gold-soft" onChange={() => setChosen(m)} />
                <Chip name={m.name} color={m.avatarColor} size="sm" />
                <span className="min-w-0 truncate">{m.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !online || !chosen}
        className={buttonClass("primary", "lg", "w-full")}
        onClick={() =>
          chosen &&
          start(async () => {
            const r = await transferAdmin(chosen.id);
            if (r.ok) close();
            setError(r.ok ? null : r.error);
          })
        }
      >
        {pending ? "A passar…" : chosen ? `Passar admin a ${chosen.name}` : "Escolhe uma pessoa"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
