"use client";

import { useActionState, useState } from "react";
import { deleteGroup } from "@/lib/actions/groups";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Confirmação forte para apagar (arquivar) o grupo: escrever o nome. O servidor volta a verificar tudo. */
export function DeleteGroupForm({ groupName, blockers }: { groupName: string; blockers: string[] }) {
  const [state, action, pending] = useActionState(deleteGroup, null);
  const [typed, setTyped] = useState("");
  const online = useOnline();
  const blocked = blockers.length > 0;
  return (
    <form action={action} className="space-y-4">
      {blocked ? (
        <div role="alert" className="rounded-2xl bg-loss/10 p-3 text-sm">
          <p className="font-semibold text-loss-soft">Ainda não dá para apagar o grupo. Falta saldar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ivory/90">
          O grupo <strong>“{groupName}”</strong> desaparece para todos os membros e ninguém o volta a ver na app. As sessões e contas não se perdem:
          ficam guardadas na base de dados.
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">
          Para confirmar, escreve <strong>{groupName}</strong>
        </span>
        <input
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          disabled={blocked}
          className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online || blocked || typed.trim() !== groupName.trim()} className={buttonClass("danger", "lg", "w-full")}>
        {pending ? "A apagar…" : "Apagar grupo"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
