"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { ChipStack } from "@/components/ui/ChipStack";
import { Money } from "@/components/ui/Money";
import { buttonClass } from "@/components/ui/Button";
import { addBuyIn, removeBuyIn, removeSessionPlayer, setCashOut, undoReconcile } from "@/lib/actions/sessions";
import { checkSession } from "@/lib/ledger";
import { centsToInput, formatCents, parseEuros } from "@/lib/money";
import type { ActionResult } from "@/lib/errors";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { exceedsSoftLimit, METHOD_LABELS, type ReconcileMethod } from "@/lib/reconcile";
import { Sheet } from "@/components/ui/Sheet";
import { PotTable } from "./PotTable";
import { MoneyInput } from "./MoneyInput";
import { ReconcileForm } from "./ReconcileForm";
import { useLiveField } from "./live-field";
import type { FieldWarning } from "@/lib/live/field";

export type LivePlayer = {
  id: string; // SessionPlayer.id
  playerId: string;
  name: string;
  avatarColor: string;
  cashOut: number | null;
  /** ajuste de contagem (cêntimos) */
  adjustment: number;
  buyIns: { id: string; amount: number }[];
};

export type Reconciliation = {
  method: ReconcileMethod;
  discrepancy: number;
  byName: string | null;
  playerName: string | null;
};

type State = { players: LivePlayer[]; rec: Reconciliation | null };

type Op =
  | { t: "add"; sp: string; id: string; amount: number }
  | { t: "rmBuy"; sp: string; id: string }
  | { t: "cash"; sp: string; amount: number | null }
  | { t: "rmPlayer"; sp: string }
  | { t: "undo" };

/** Qualquer alteração a entradas/cash-outs anula o ajuste (o servidor faz o mesmo). */
const clearAdjustment = (s: State): State =>
  s.rec ? { players: s.players.map((p) => ({ ...p, adjustment: 0 })), rec: null } : s;

function reduce(state: State, op: Op): State {
  const s = clearAdjustment(state);
  if (op.t === "undo") return s;
  return { ...s, players: reducePlayers(s.players, op) };
}

function reducePlayers(list: LivePlayer[], op: Exclude<Op, { t: "undo" }>): LivePlayer[] {
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
  sessionId,
  players,
  reconciliation,
  defaultBuyIn,
  editable,
  isAdmin,
}: {
  sessionId: string;
  players: LivePlayer[];
  reconciliation: Reconciliation | null;
  defaultBuyIn: number;
  editable: boolean;
  isAdmin: boolean;
}) {
  const [state, apply] = useOptimistic<State, Op>({ players, rec: reconciliation }, reduce);
  const list = state.players;
  const rec = state.rec;
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dropFor, setDropFor] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const online = useOnline();
  const canEdit = editable && online;

  // Linha a ser editada: se outra pessoa tirar esse jogador, avisa em vez de a linha desaparecer em silêncio.
  const editing = useRef<{ id: string; name: string } | null>(null);
  const myRemovals = useRef(new Set<string>());
  const [gone, setGone] = useState<string | null>(null);
  useEffect(() => {
    const e = editing.current;
    if (e && !players.some((p) => p.id === e.id) && !myRemovals.current.has(e.id)) {
      editing.current = null;
      setGone(e.name);
    }
  }, [players]);

  const act = (op: Op, call: () => Promise<ActionResult>) => {
    setError(null);
    if (op.t === "add") setDropFor(op.sp);
    start(async () => {
      apply(op);
      const r = await call();
      if (!r.ok) setError(r.error);
    });
  };

  const totals = checkSession(
    list.map((p) => ({ playerId: p.playerId, cashOut: p.cashOut, adjustment: p.adjustment, buyIns: p.buyIns.map((b) => b.amount) })),
    rec !== null,
  );
  const needsAdjust = totals.missingCashOuts === 0 && totals.diff !== 0 && !rec;

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
            ? rec
              ? "✓ Diferença ajustada: esta sessão conta para o fecho."
              : "✓ Contas certas: esta sessão conta para o fecho."
            : totals.missingCashOuts > 0
              ? `! Faltam ${totals.missingCashOuts} cash-out${totals.missingCashOuts === 1 ? "" : "s"}${
                  totals.diff !== 0 ? ` · diferença de ${totals.diff > 0 ? "+" : "−"}${formatCents(totals.diff)}` : ""
                }.`
              : "! Diferença de contagem por ajustar: não conta para o fecho."}
        </p>
      </div>

      {/* A sheet fica montada enquanto estiver aberta, mesmo que outra pessoa ajuste a diferença entretanto. */}
      {(needsAdjust || adjustOpen) && (
        <section
          aria-label={needsAdjust ? "Diferença de contagem" : undefined}
          className={needsAdjust ? "mt-4 rounded-[24px] border border-gold-soft/40 bg-ink/50 p-4" : ""}
        >
          {needsAdjust && (
            <>
              <p className="text-[17px] font-semibold text-gold-soft">Recontem as fichas antes de ajustar.</p>
              <p className="mt-1 font-display text-[22px] font-semibold">
                {totals.diff > 0 ? "Sobram" : "Faltam"} <Money cents={Math.abs(totals.diff)} />
              </p>
              <p className="mt-1 text-[13px] text-ivory/80">
                Os cash-outs {totals.diff > 0 ? "somam mais" : "somam menos"} do que as entradas. Se a recontagem confirmar, ajusta: os
                cash-outs ficam como estão e cada jogador recebe uma linha de ajuste.
              </p>
              {exceedsSoftLimit(totals.diff, totals.totalIn) && (
                <p className="mt-2 text-sm font-semibold text-loss-soft">⚠ Diferença grande: confirmar o ajuste exige o PIN de admin.</p>
              )}
            </>
          )}
          {editable && (
            <div className={needsAdjust ? "mt-3" : ""}>
              <Sheet
                label="Ajustar diferença"
                title="Ajustar diferença"
                disabled={!online}
                size="sm"
                triggerClassName={needsAdjust ? "" : "hidden"}
                onOpenChange={setAdjustOpen}
              >
                <ReconcileForm
                  sessionId={sessionId}
                  isAdmin={isAdmin}
                  stale={!needsAdjust}
                  rows={list.map((p) => ({
                    id: p.id,
                    name: p.name,
                    buyInTotal: p.buyIns.reduce((s, b) => s + b.amount, 0),
                    cashOut: p.cashOut ?? 0,
                  }))}
                />
              </Sheet>
            </div>
          )}
        </section>
      )}

      {rec && (
        <section aria-label="Ajuste de contagem" className="mt-4 rounded-[24px] bg-ink/40 p-4 text-sm">
          <p className="font-semibold">
            Ajuste de contagem: {rec.discrepancy > 0 ? "sobravam" : "faltavam"} <Money cents={Math.abs(rec.discrepancy)} />
          </p>
          <p className="mt-0.5 text-[13px] text-ivory/80">
            {METHOD_LABELS[rec.method]}
            {rec.playerName ? ` (${rec.playerName})` : ""}
            {rec.byName ? ` · confirmado por ${rec.byName}` : ""}
          </p>
          {editable && (
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => act({ t: "undo" }, () => undoReconcile(sessionId))}
              className={buttonClass("secondary", "sm", "mt-3")}
            >
              Desfazer ajuste
            </button>
          )}
        </section>
      )}

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-3 rounded-2xl bg-ink/60 px-4 py-3 text-sm">
          <p className="flex-1 text-loss-soft">Não foi possível guardar: {error} A alteração foi desfeita.</p>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro" className="text-lg text-ivory/80">
            ×
          </button>
        </div>
      )}
      {gone && (
        <div role="status" className="mt-3 flex items-start gap-3 rounded-2xl bg-ink/60 px-4 py-3 text-sm">
          <p className="flex-1">Outra pessoa tirou {gone} da sessão; o que estavas a escrever nessa linha não foi guardado.</p>
          <button type="button" onClick={() => setGone(null)} aria-label="Fechar aviso" className="text-lg text-ivory/80">
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
            onRemove={() => {
              myRemovals.current.add(p.id);
              act({ t: "rmPlayer", sp: p.id }, () => removeSessionPlayer(p.id));
            }}
            onEditing={(on) => {
              if (on) editing.current = { id: p.id, name: p.name };
              else if (editing.current?.id === p.id) editing.current = null;
            }}
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
  onEditing,
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
  onEditing: (on: boolean) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Campos que podem mudar no servidor enquanto se escreve: nunca sobrescrever o rascunho (lib/live/field.ts).
  const cash = useLiveField(p.cashOut === null ? "" : centsToInput(p.cashOut));
  const rebuy = useLiveField(centsToInput(defaultBuyIn));
  const total = p.buyIns.reduce((s, b) => s + b.amount, 0);
  const net = p.cashOut === null ? null : p.cashOut - total + p.adjustment;

  return (
    <li
      className="glass rounded-[24px] p-4"
      onFocus={() => onEditing(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEditing(false);
      }}
    >
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
            const v = parseEuros(rebuy.value);
            if (!v) return setLocalError("Valor inválido (ex.: 15 ou 12,50).");
            setLocalError(null);
            setCustom(false);
            rebuy.saved(centsToInput(defaultBuyIn));
            onRebuy(v);
          }}
        >
          <MoneyInput label={`Valor da entrada de ${p.name}`} name="amount" className="flex-1" autoFocus required {...rebuy.inputProps} />
          <button type="submit" disabled={!canEdit} className={buttonClass("secondary", "md")}>
            Adicionar
          </button>
        </form>
      )}

      {editable && custom && rebuy.warning && <FieldWarningNote warning={rebuy.warning} onUse={rebuy.useServerValue} />}

      {editable ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const raw = cash.value.trim();
            if (raw === "") {
              cash.saved("");
              return onCash(null);
            }
            const v = parseEuros(raw);
            if (v === null) return setLocalError("Cash-out inválido (ex.: 35 ou 12,50).");
            setLocalError(null);
            cash.saved(centsToInput(v));
            onCash(v);
          }}
        >
          <MoneyInput label={`Cash-out de ${p.name}`} name="cashOut" className="flex-1" placeholder="Com quanto sai?" {...cash.inputProps} />
          <button type="submit" disabled={!canEdit} className={buttonClass("secondary", "md")}>
            Guardar
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ivory/80">
          Cash-out: {p.cashOut === null ? "—" : <Money cents={p.cashOut} />}
        </p>
      )}
      {editable && cash.warning && <FieldWarningNote warning={cash.warning} onUse={cash.useServerValue} />}
      {p.adjustment !== 0 && (
        <p className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-ink/30 px-3 py-1.5 text-sm">
          <span>Ajuste de contagem</span>
          <Money cents={p.adjustment} signed />
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

/** "Valor alterado por Rui: 35,00 €" + "Usar esse valor" (descarta o rascunho). */
function FieldWarningNote({ warning, onUse }: { warning: FieldWarning; onUse: () => void }) {
  return (
    <p role="status" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink/40 px-3 py-1.5 text-sm">
      <span>
        Valor alterado por {warning.changedBy ?? "outra pessoa"}: {warning.serverValue === "" ? "vazio" : `${warning.serverValue} €`}
      </span>
      <button type="button" onClick={onUse} className="min-h-9 rounded-full px-2 font-semibold text-gold-soft">
        Usar esse valor
      </button>
    </p>
  );
}
