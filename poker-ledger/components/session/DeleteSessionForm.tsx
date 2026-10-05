"use client";

import { useState, useTransition } from "react";
import { deleteSession } from "@/lib/actions/sessions";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Confirmação para apagar uma sessão em aberto (só admin; o servidor volta a verificar). */
export function DeleteSessionForm({ sessionId, summary }: { sessionId: string; summary: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  return (
    <div className="space-y-4">
      <p className="text-sm text-ivory/90">
        Vais apagar <strong>{summary}</strong>, com todos os jogadores, entradas, cash-outs e ajustes desta sessão. Não dá para desfazer. Fica
        registado no histórico de atividade.
      </p>
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !online}
        className={buttonClass("danger", "lg", "w-full")}
        onClick={() =>
          start(async () => {
            const r = await deleteSession(sessionId);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        {pending ? "A apagar…" : "Apagar definitivamente"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
