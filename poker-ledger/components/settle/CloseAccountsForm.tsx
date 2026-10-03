"use client";

import { useActionState } from "react";
import { closeAccounts } from "@/lib/actions/settlements";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Confirmação do fecho (só admin). O servidor volta a validar tudo. */
export function CloseAccountsForm({ defaultLabel, sessions, transfers }: { defaultLabel: string; sessions: number; transfers: number }) {
  const [state, action, pending] = useActionState(closeAccounts, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-ivory/85">
        Vais juntar <strong>{sessions}</strong> {sessions === 1 ? "sessão" : "sessões"} e gerar <strong>{transfers}</strong>{" "}
        {transfers === 1 ? "transferência" : "transferências"}. As sessões ficam bloqueadas para edição. Não dá para desfazer.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome do fecho</span>
        <input name="label" defaultValue={defaultLabel} maxLength={60} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "A fechar…" : "Confirmar e fechar contas"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
