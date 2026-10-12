"use client";

import { useActionState } from "react";
import { createGroup } from "@/lib/actions/groups";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Criar um grupo: quem cria fica admin. */
export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome do grupo</span>
        <input name="name" required minLength={2} maxLength={40} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A criar…" : "Criar grupo (ficas admin)"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
