"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Ticket } from "@/components/ui/Ticket";
import { buttonClass } from "@/components/ui/Button";
import { setTransferPaid } from "@/lib/actions/settlements";
import { useOnline } from "@/lib/use-online";
import { CopyButton } from "./CopyButton";

type Party = { id: string; name: string; avatarColor: string };

export function TicketLive({
  t,
  canMark,
}: {
  t: { id: string; amount: number; paid: boolean; from: Party; to: Party & { ibanOrMbway: string | null } };
  canMark: boolean;
}) {
  const [paid, setPaid] = useOptimistic(t.paid);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  return (
    <li>
      <Ticket from={t.from} to={t.to} amount={t.amount} paid={paid}>
        {t.to.ibanOrMbway ? (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm">
              <span className="block text-[13px] text-ivory/75">IBAN / MB WAY de {t.to.name}</span>
              <span className="block font-mono text-[14px] break-all">{t.to.ibanOrMbway}</span>
            </p>
            <CopyButton text={t.to.ibanOrMbway} label={`Copiar IBAN ou MB WAY de ${t.to.name}`} />
          </div>
        ) : (
          <p className="text-[13px] text-ivory/75">{t.to.name} ainda não indicou IBAN nem MB WAY.</p>
        )}
        {canMark && (
          <button
            type="button"
            disabled={!online}
            className={buttonClass(paid ? "secondary" : "primary", "sm", "mt-3")}
            onClick={() => {
              setError(null);
              const next = !paid;
              start(async () => {
                setPaid(next);
                const r = await setTransferPaid(t.id, next);
                if (!r.ok) setError(r.error);
              });
            }}
          >
            {paid ? "Desfazer: marcar por pagar" : "Marcar como paga"}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-loss-soft">
            Não foi possível guardar: {error}
          </p>
        )}
      </Ticket>
    </li>
  );
}
