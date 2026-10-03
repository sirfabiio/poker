"use client";

import { useMemo, useState, useTransition } from "react";
import { reconcileSession } from "@/lib/actions/sessions";
import { exceedsSoftLimit, METHOD_LABELS, reconcile, RECONCILE_METHODS, type ReconcileMethod } from "@/lib/reconcile";
import { RECONCILE_SOFT_LIMIT_CENTS, RECONCILE_SOFT_LIMIT_PERCENT } from "@/lib/config";
import { formatCents } from "@/lib/money";
import { Money } from "@/components/ui/Money";
import { buttonClass } from "@/components/ui/Button";
import { useSheet } from "@/components/ui/Sheet";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

type Row = { id: string; name: string; buyInTotal: number; cashOut: number };

const HINTS: Record<ReconcileMethod, string> = {
  EQUAL: "A diferença é dividida em partes iguais por todos.",
  PROPORTIONAL: "Quem entrou com mais absorve mais (pesos = total de entradas).",
  SINGLE_PLAYER: "Um jogador absorve a diferença toda (ex.: quem contou mal).",
};

/** Escolha do método de ajuste com pré-visualização em tempo real: cash-out, ajuste e líquido por jogador. */
export function ReconcileForm({ sessionId, rows, isAdmin }: { sessionId: string; rows: Row[]; isAdmin: boolean }) {
  const [method, setMethod] = useState<ReconcileMethod>("EQUAL");
  const [single, setSingle] = useState(rows[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useSheet();
  const online = useOnline();

  const totalIn = rows.reduce((s, r) => s + r.buyInTotal, 0);
  const preview = useMemo(() => {
    try {
      return reconcile({ players: rows, method, singlePlayerId: single });
    } catch {
      return null;
    }
  }, [rows, method, single]);
  const D = preview?.discrepancy ?? rows.reduce((s, r) => s + r.cashOut, 0) - totalIn;
  const over = exceedsSoftLimit(D, totalIn);
  const needsPin = over && !isAdmin;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const pin = String(new FormData(e.currentTarget).get("pin") ?? "");
        setError(null);
        start(async () => {
          const r = await reconcileSession(sessionId, {
            method,
            singlePlayerId: method === "SINGLE_PLAYER" ? single : null,
            expectedDiscrepancy: D,
            pin: needsPin ? pin : undefined,
          });
          if (!r.ok) return setError(r.error);
          sheet.close();
        });
      }}
    >
      <p className="font-semibold text-gold-soft">Recontem as fichas antes de ajustar.</p>
      <p className="text-sm text-ivory/85">
        {D > 0 ? "Sobram" : "Faltam"} <strong className="money">{formatCents(D)}</strong>. Os cash-outs não mudam: cada jogador recebe uma linha
        “Ajuste de contagem”.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm text-ivory/80">Como dividir a diferença?</legend>
        <div className="space-y-1.5">
          {RECONCILE_METHODS.map((m) => (
            <label key={m} className="flex min-h-12 items-start gap-3 rounded-2xl bg-ink/30 px-3 py-2.5">
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="mt-1 size-5 shrink-0 accent-[#D4AF37]"
              />
              <span>
                <span className="block font-semibold">{METHOD_LABELS[m]}</span>
                <span className="block text-[13px] text-ivory/75">{HINTS[m]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {method === "SINGLE_PLAYER" && (
        <label className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">Quem absorve a diferença?</span>
          <select
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/20 bg-ink/60 px-3"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="rounded-2xl bg-ink/30 px-3 py-2 text-[14px]" aria-live="polite">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-1.5">
          <span className="text-[13px] text-ivory/75">Jogador</span>
          <span className="text-right text-[13px] text-ivory/75">Cash-out</span>
          <span className="text-right text-[13px] text-ivory/75">Ajuste</span>
          <span className="text-right text-[13px] text-ivory/75">Líquido</span>
          {rows.map((r, i) => {
            const a = preview?.adjustments[i].adjustment ?? 0;
            return (
              <div key={r.id} className="contents">
                <span className="truncate">{r.name}</span>
                <Money cents={r.cashOut} size="sm" className="text-right" />
                <Money cents={a} signed size="sm" className="justify-end" />
                <Money cents={r.cashOut - r.buyInTotal + a} signed size="sm" className="justify-end" />
              </div>
            );
          })}
        </div>
      </div>

      {over && (
        <div role="alert" className="rounded-2xl border border-loss/60 bg-loss/10 p-3 text-sm">
          <p className="font-semibold text-loss-soft">⚠ Diferença grande</p>
          <p className="mt-1 text-ivory/90">
            Passa o limite de {formatCents(RECONCILE_SOFT_LIMIT_CENTS)} ou {RECONCILE_SOFT_LIMIT_PERCENT} % das entradas. Contem as fichas outra vez
            com calma: um erro deste tamanho costuma ser um cash-out mal escrito.
            {needsPin ? " Para confirmar é preciso o PIN de admin." : " Estás em modo admin."}
          </p>
          {needsPin && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm text-ivory/80">PIN de admin</span>
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                required
                minLength={6}
                className="money h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3 tracking-[0.3em]"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !online || !preview} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "A confirmar…" : "Confirmar ajuste"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
