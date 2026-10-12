"use client";

import { useActionState } from "react";
import { renameGroup } from "@/lib/actions/groups";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Renomear o grupo atual (só admin; o servidor volta a verificar). */
export function RenameGroupForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(renameGroup, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome do grupo</span>
        <input key={name} name="name" defaultValue={name} required minLength={2} maxLength={40} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-win">
          Nome guardado.
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("secondary", "md", "w-full")}>
        {pending ? "A guardar…" : "Guardar nome"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
