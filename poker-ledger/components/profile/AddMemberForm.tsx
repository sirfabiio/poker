"use client";

import { useActionState } from "react";
import { addMember } from "@/lib/actions/players";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Admin junta alguém ao grupo pelo nome (pessoa já registada ou perfil novo, que define o PIN no 1.º acesso). */
export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome da pessoa</span>
        <input name="name" required minLength={2} maxLength={30} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-win" : "text-loss-soft"}`}>
          {state.ok
            ? state.created
              ? "✓ Perfil criado e junto ao grupo. No primeiro acesso, a pessoa escolhe o PIN."
              : "✓ Junto ao grupo."
            : state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A juntar…" : "Juntar ao grupo"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
