"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { ChipStack } from "@/components/ui/ChipStack";
import { Money } from "@/components/ui/Money";
import { buttonClass } from "@/components/ui/Button";
import { addBuyIn, removeBuyIn, removeSessionPlayer, setCashOut } from "@/lib/actions/sessions";
import { checkSession } from "@/lib/ledger";
import { centsToInput, formatCents, parseEuros } from "@/lib/money";
import type { ActionResult } from "@/lib/errors";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PotTable } from "./PotTable";
import { MoneyInput } from "./MoneyInput";

export type LivePlayer = {
  id: string; // SessionPlayer.id
  playerId: string;
  name: string;
  avatarColor: string;
  cashOut: number | null;
  buyIns: { id: string; amount: number }[];
};

type Op =
  | { t: "add"; sp: string; id: string; amount: number }
  | { t: "rmBuy"; sp: string; id: string }
  | { t: "cash"; sp: string; amount: number | null }
  | { t: "rmPlayer"; sp: string };

function reduce(list: LivePlayer[], op: Op): LivePlayer[] {
  if (op.t === "rmPlayer") return list.filter((p) => p.id !== op.sp);
  return list.map((p) => {
    if (p.id !== op.sp) return p;
    if (op.t === "add") return { ...p, buyIns: [...p.buyIns, { id: op.id, amount: op.amount }] };
    if (op.t === "rmBuy") return { ...p, buyIns: p.buyIns.filter((b) => b.id !== op.id) };
    return { ...p, cashOut: op.amount };
  });
}

let tmp = 0;

/** Quadro da sessão com atualização otimista (rollback automático e mensagem se o servidor falhar). */
export function SessionLive({
  players,
  defaultBuyIn,
  editable,
}: {
  players: LivePlayer[];
  defaultBuyIn: number;
  editable: boolean;
}) {
  const [list, apply] = useOptimistic(players, reduce);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dropFor, setDropFor] = useState<string | null>(null);
  const online = useOnline();
  const canEdit = editable && online;

  const act = (op: Op, call: () => Promise<ActionResult>) => {
    setError(null);
    if (op.t === "add") setDropFor(op.sp);
    start(async () => {
      apply(op);
      const r = await call();
      if (!r.ok) setError(r.error);
    });
  };

  const totals = checkSession(list.map((p) => ({ playerId: p.playerId, cashOut: p.cashOut, buyIns: p.buyIns.map((b) => b.amount) })));

  return (
    <>
      <PotTable pot={totals.totalIn} players={list.length} />

      <div
        className={`mt-4 rounded-2xl px-4 py-3 text-sm ${totals.valid ? "bg-win/10" : "bg-loss/10"}`}
        aria-live="polite"
      >
        <div className="flex justify-between gap-3">
          <span>
            Entradas <Money cents={totals.totalIn} className="font-semibold" />
          </span>
          <span>
            Cash-outs <Money cents={totals.totalOut} className="font-semibold" />
          </span>
        </div>
        <p className={`mt-1 font-semibold ${totals.valid ? "text-win" : "text-loss-soft"}`}>
          {totals.valid
            ? "✓ Contas certas: esta sessão conta para o fecho."
            : totals.missingCashOuts > 0
              ? `! Faltam ${totals.missingCashOuts} cash-out${totals.missingCashOuts === 1 ? "" : "s"}${
                  totals.diff !== 0 ? ` · diferença de ${totals.diff > 0 ? "+" : "−"}${formatCents(totals.diff)}` : ""
                }.`
              : `! Os cash-outs ${totals.diff > 0 ? "excedem" : "ficam abaixo de"} as entradas em ${formatCents(totals.diff)}. Corrige antes do fecho.`}
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-3 rounded-2xl bg-ink/60 px-4 py-3 text-sm">
          <p className="flex-1 text-loss-soft">Não foi possível guardar: {error} A alteração foi desfeita.</p>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro" className="text-lg text-ivory/80">
            ×
          </button>
        </div>
      )}
      {editable && !online && <p className="mt-3 text-sm text-ivory/75">{OFFLINE_HINT}</p>}

      <ul className="mt-4 space-y-3">
        {list.map((p) => (
          <PlayerCard
            key={p.id}
            p={p}
            defaultBuyIn={defaultBuyIn}
            editable={editable}
            canEdit={canEdit}
            drop={dropFor === p.id}
            onRebuy={(amount) => act({ t: "add", sp: p.id, id: `tmp-${++tmp}`, amount }, () => addBuyIn(p.id, amount))}
            onRemoveBuy={(id) => act({ t: "rmBuy", sp: p.id, id }, () => removeBuyIn(id))}
            onCash={(amount) => act({ t: "cash", sp: p.id, amount }, () => setCashOut(p.id, amount))}
            onRemove={() => act({ t: "rmPlayer", sp: p.id }, () => removeSessionPlayer(p.id))}
          />
        ))}
      </ul>
    </>
  );
}

function PlayerCard({
  p,
  defaultBuyIn,
  editable,
  canEdit,
  drop,
  onRebuy,
  onRemoveBuy,
  onCash,
  onRemove,
}: {
  p: LivePlayer;
  defaultBuyIn: number;
  editable: boolean;
  canEdit: boolean;
  drop: boolean;
  onRebuy: (amount: number) => void;
  onRemoveBuy: (id: string) => void;
  onCash: (amount: number | null) => void;
  onRemove: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const total = p.buyIns.reduce((s, b) => s + b.amount, 0);
  const net = p.cashOut === null ? null : p.cashOut - total;

  return (
    <li className="glass rounded-[24px] p-4">
      <div className="flex items-center gap-3">
        <Chip name={p.name} color={p.avatarColor} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="text-[13px] text-ivory/75">
            Entrou com <Money cents={total} size="sm" className="text-[13px]" />
          </p>
        </div>
        <ChipStack count={p.buyIns.length} animateTop={drop} />
        <div className="w-[104px] shrink-0 text-right">
          {net === null ? (
            <span className="text-[13px] text-ivory/75">Em jogo</span>
          ) : (
            <Money cents={net} signed className="font-semibold" />
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!canEdit} onClick={() => onRebuy(defaultBuyIn)} className={buttonClass("primary", "sm")}>
            Rebuy {formatCents(defaultBuyIn)}
          </button>
          <button
            type="button"
            disabled={!canEdit}
            aria-expanded={custom}
            onClick={() => setCustom((v) => !v)}
            className={buttonClass("secondary", "sm")}
          >
            Outro valor
          </button>
        </div>
      )}

      {editable && custom && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = parseEuros(String(new FormData(e.currentTarget).get("amount") ?? ""));
            if (!v) return setLocalError("Valor inválido (ex.: 15 ou 12,50).");
            setLocalError(null);
            setCustom(false);
            onRebuy(v);
          }}
        >
          <MoneyInput label={`Valor da entrada de ${p.name}`} name="amount" className="flex-1" autoFocus required />
          <button type="submit" disabled={!canEdit} className={buttonClass("secondary", "md")}>
            Adicionar
          </button>
        </form>
      )}

      {editable ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const raw = String(new FormData(e.currentTarget).get("cashOut") ?? "").trim();
            if (raw === "") return onCash(null);
            const v = parseEuros(raw);
            if (v === null) return setLocalError("Cash-out inválido (ex.: 35 ou 12,50).");
            setLocalError(null);
            onCash(v);
          }}
        >
          <MoneyInput
            key={p.cashOut ?? "vazio"}
            label={`Cash-out de ${p.name}`}
            name="cashOut"
            className="flex-1"
            placeholder="Com quanto sai?"
            defaultValue={p.cashOut === null ? "" : centsToInput(p.cashOut)}
          />
          <button type="submit" disabled={!canEdit} className={buttonClass("secondary", "md")}>
            Guardar
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ivory/80">
          Cash-out: {p.cashOut === null ? "—" : <Money cents={p.cashOut} />}
        </p>
      )}
      {localError && (
        <p role="alert" className="mt-2 text-sm text-loss-soft">
          {localError}
        </p>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer py-1 text-ivory/80">
          Entradas ({p.buyIns.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {p.buyIns.map((b, i) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink/30 px-3 py-1.5">
              <span>
                {i === 0 ? "Buy-in" : `Rebuy ${i}`} · <Money cents={b.amount} />
              </span>
              {editable && (
                <button
                  type="button"
                  disabled={!canEdit || b.id.startsWith("tmp-")}
                  onClick={() => onRemoveBuy(b.id)}
                  className="min-h-9 rounded-full px-3 text-loss-soft disabled:opacity-50"
                  aria-label={`Remover ${i === 0 ? "buy-in" : `rebuy ${i}`} de ${formatCents(b.amount)}`}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              if (confirm(`Tirar ${p.name} desta sessão? As entradas dele/dela são apagadas.`)) onRemove();
            }}
            className={buttonClass("danger", "sm", "mt-3")}
          >
            Tirar da sessão
          </button>
        )}
      </details>
    </li>
  );
}
