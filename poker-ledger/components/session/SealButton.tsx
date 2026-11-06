"use client";

import { useState, useTransition } from "react";
import { sealSession, unsealSession } from "@/lib/actions/sessions";
import { buttonClass } from "@/components/ui/Button";
import { Sheet, useSheet } from "@/components/ui/Sheet";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Lacrar (admin ou quem criou a sessão) ou tirar o lacre (só admin), com confirmação numa folha da app. */
export function SealButton({ sessionId, mode }: { sessionId: string; mode: "seal" | "unseal" }) {
  const seal = mode === "seal";
  return (
    <Sheet
      label={seal ? "🔏︎ Lacrar sessão" : "Tirar lacre"}
      title={seal ? "Lacrar sessão" : "Tirar lacre"}
      variant={seal ? "primary" : "secondary"}
      size="sm"
    >
      <SealConfirm sessionId={sessionId} seal={seal} />
    </Sheet>
  );
}

function SealConfirm({ sessionId, seal }: { sessionId: string; seal: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const { close } = useSheet();
  return (
    <div className="space-y-4">
      <p className="text-sm text-ivory/90">
        {seal ? (
          <>
            Depois de lacrada, <strong>só o admin do grupo</strong> pode alterar esta sessão: jogadores, rebuys, cash-outs e ajustes. Nem
            quem a criou consegue mudar. Fica registado no histórico de atividade.
          </>
        ) : (
          <>
            A sessão volta a poder ser alterada por quem a criou e pelos membros do grupo. Fica registado no histórico de atividade.
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={close} className={buttonClass("secondary", "lg", "flex-1")}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending || !online}
          className={buttonClass("primary", "lg", "flex-1")}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await (seal ? sealSession(sessionId) : unsealSession(sessionId));
              if (r.ok) close();
              else setError(r.error);
            });
          }}
        >
          {pending ? (seal ? "A lacrar…" : "A tirar…") : seal ? "Lacrar" : "Tirar lacre"}
        </button>
      </div>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
