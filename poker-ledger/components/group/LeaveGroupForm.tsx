"use client";

import { useState, useTransition } from "react";
import { leaveGroup } from "@/lib/actions/groups";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Confirmação para sair do grupo (o servidor volta a verificar as contas). */
export function LeaveGroupForm({ groupName, blockers }: { groupName: string; blockers: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const blocked = blockers.length > 0;
  return (
    <div className="space-y-4">
      {blocked ? (
        <div role="alert" className="rounded-2xl bg-loss/10 p-3 text-sm">
          <p className="font-semibold text-loss-soft">Ainda não podes sair. Falta saldar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ivory/90">
          Vais sair do grupo <strong>“{groupName}”</strong>. Deixas de o ver, mas as sessões e contas antigas ficam iguais. Para voltar, o admin
          tem de te juntar outra vez.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !online || blocked}
        className={buttonClass("danger", "lg", "w-full")}
        onClick={() =>
          start(async () => {
            const r = await leaveGroup();
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        {pending ? "A sair…" : "Sair do grupo"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
