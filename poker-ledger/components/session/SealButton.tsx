"use client";

import { useState, useTransition } from "react";
import { sealSession, unsealSession } from "@/lib/actions/sessions";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Lacrar (admin ou quem criou a sessão) ou tirar o lacre (só admin). O servidor volta a verificar. */
export function SealButton({ sessionId, mode }: { sessionId: string; mode: "seal" | "unseal" }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const seal = mode === "seal";
  return (
    <div>
      <button
        type="button"
        disabled={pending || !online}
        className={buttonClass(seal ? "primary" : "secondary", "sm")}
        onClick={() => {
          const msg = seal
            ? "Lacrar esta sessão? Depois disto só o admin do grupo a pode alterar (nem quem a criou)."
            : "Tirar o lacre? A sessão volta a poder ser alterada por quem a criou e pelos membros.";
          if (!confirm(msg)) return;
          setError(null);
          start(async () => {
            const r = await (seal ? sealSession(sessionId) : unsealSession(sessionId));
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {pending ? (seal ? "A lacrar…" : "A tirar o lacre…") : seal ? "🔏︎ Lacrar sessão" : "Tirar lacre"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-loss-soft">
          {error}
        </p>
      )}
      {!online && <p className="mt-2 text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
