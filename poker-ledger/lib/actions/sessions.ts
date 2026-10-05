"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { STATS_TAG } from "../config";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { requirePlayer } from "../identity";
import { logActivity } from "../activity";
import { isValidAmount, formatCents } from "../money";
import { formatDay, parseDateInput } from "../format";
import { checkAdminPin, isAdmin, requireAdmin } from "../admin";
import { exceedsSoftLimit, isReconcileMethod, METHOD_LABELS, reconcile, ReconcileError, type ReconcileMethod } from "../reconcile";

const CLOSED = "Esta sessão já foi fechada nas contas e não pode ser editada.";

type LockedSession = {
  settlementId: string | null;
  date: Date;
  reconciledAt: Date | null;
  discrepancy: number | null;
  adjustmentMethod: ReconcileMethod | null;
};

/** Bloqueia a linha da sessão (FOR UPDATE) e garante que ainda está em aberto. */
async function lockOpenSession(tx: Prisma.TransactionClient, sessionId: string) {
  const rows = await tx.$queryRaw<LockedSession[]>`
    SELECT "settlementId", "date", "reconciledAt", "discrepancy", "adjustmentMethod"::text AS "adjustmentMethod"
    FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE`;
  if (rows.length === 0) throw new UserError("Sessão não encontrada.");
  if (rows[0].settlementId) throw new UserError(CLOSED, "closed");
  return rows[0];
}

/** Repõe a sessão sem ajuste de contagem (adjustment = 0, campos de reconciliação a null). */
async function clearAdjustment(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.sessionPlayer.updateMany({ where: { sessionId }, data: { adjustment: 0 } });
  await tx.session.update({
    where: { id: sessionId },
    data: { discrepancy: null, adjustmentMethod: null, adjustmentPlayerId: null, reconciledAt: null, reconciledByPlayerId: null },
  });
}

/** Qualquer alteração a entradas ou cash-outs de uma sessão ajustada anula o ajuste. */
async function annulAdjustmentIfAny(
  tx: Prisma.TransactionClient,
  sessionId: string,
  s: LockedSession,
  viewer: { id: string; name: string },
) {
  if (!s.reconciledAt) return;
  await clearAdjustment(tx, sessionId);
  await logActivity(tx, {
    actorPlayerId: viewer.id,
    action: "adjustment.annul",
    entityType: "session",
    entityId: sessionId,
    summary: `Ajuste de contagem anulado automaticamente (${s.adjustmentMethod ? METHOD_LABELS[s.adjustmentMethod] : "?"}, D = ${
      s.discrepancy ?? 0
    } cêntimos) porque ${viewer.name} alterou entradas ou cash-outs (${formatDay(s.date)})`,
  });
}

async function lockBySessionPlayer(tx: Prisma.TransactionClient, sessionPlayerId: string) {
  const sp = await tx.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    select: { sessionId: true, player: { select: { name: true } } },
  });
  if (!sp) throw new UserError("Jogador não encontrado nesta sessão.");
  const s = await lockOpenSession(tx, sp.sessionId);
  return { sessionId: sp.sessionId, playerName: sp.player.name, day: formatDay(s.date), locked: s };
}

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

async function assertActivePlayers(tx: Prisma.TransactionClient, ids: string[]) {
  const n = await tx.player.count({ where: { id: { in: ids }, active: true } });
  if (n !== ids.length) throw new UserError("Um dos jogadores escolhidos não existe ou está desativado.");
}

const done = (sessionId?: string) => {
  revalidateTag(STATS_TAG); // ranking e estatísticas
  revalidatePath("/", "layout");
  return sessionId;
};

export type NewSessionInput = { date: string; defaultBuyIn: number; playerIds: string[]; notes?: string };

export async function createSession(input: NewSessionInput): Promise<ActionResult> {
  let id = "";
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const date = parseDateInput(String(input?.date ?? ""));
    if (!date) throw new UserError("Escolhe uma data válida.");
    if (!isValidAmount(input.defaultBuyIn)) throw new UserError("O buy-in tem de ser maior que zero.");
    const ids = uniqueIds(input.playerIds);
    if (ids.length < 2) throw new UserError("Escolhe pelo menos 2 jogadores.");
    const notes = String(input.notes ?? "").trim().slice(0, 280) || null;
    id = await db.$transaction(async (tx) => {
      await assertActivePlayers(tx, ids);
      const s = await tx.session.create({
        data: {
          date,
          notes,
          defaultBuyIn: input.defaultBuyIn,
          createdByPlayerId: viewer.id,
          players: { create: ids.map((playerId) => ({ playerId, buyIns: { create: { amount: input.defaultBuyIn } } })) },
        },
        select: { id: true },
      });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "session.create",
        entityType: "session",
        entityId: s.id,
        summary: `${viewer.name} criou a sessão de ${formatDay(date)} com ${ids.length} jogadores`,
      });
      return s.id;
    });
    return {};
  });
  if (r.ok) {
    done();
    redirect(`/sessoes/${id}`);
  }
  return r;
}

export async function updateSession(
  sessionId: string,
  input: { date: string; defaultBuyIn: number; notes?: string },
): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const date = parseDateInput(String(input?.date ?? ""));
    if (!date) throw new UserError("Escolhe uma data válida.");
    if (!isValidAmount(input.defaultBuyIn)) throw new UserError("O buy-in tem de ser maior que zero.");
    const notes = String(input.notes ?? "").trim().slice(0, 280) || null;
    await db.$transaction(async (tx) => {
      await lockOpenSession(tx, sessionId);
      await tx.session.update({ where: { id: sessionId }, data: { date, notes, defaultBuyIn: input.defaultBuyIn } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "session.update",
        entityType: "session",
        entityId: sessionId,
        summary: `${viewer.name} editou a sessão de ${formatDay(date)}`,
      });
    });
    return {};
  });
  if (r.ok) done(sessionId);
  return r;
}

export async function addSessionPlayers(sessionId: string, playerIds: string[]): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const ids = uniqueIds(playerIds);
    if (ids.length === 0) throw new UserError("Escolhe pelo menos um jogador.");
    await db.$transaction(async (tx) => {
      const s = await lockOpenSession(tx, sessionId);
      await assertActivePlayers(tx, ids);
      const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: { defaultBuyIn: true, players: { select: { playerId: true } } },
      });
      const present = new Set(session.players.map((p) => p.playerId));
      const toAdd = ids.filter((id) => !present.has(id));
      for (const playerId of toAdd) {
        await tx.sessionPlayer.create({
          data: { sessionId, playerId, buyIns: { create: { amount: session.defaultBuyIn } } },
        });
      }
      if (toAdd.length) {
        await annulAdjustmentIfAny(tx, sessionId, s, viewer);
        const names = await tx.player.findMany({ where: { id: { in: toAdd } }, select: { name: true } });
        await logActivity(tx, {
          actorPlayerId: viewer.id,
          action: "session.addPlayers",
          entityType: "session",
          entityId: sessionId,
          summary: `${viewer.name} juntou ${names.map((n) => n.name).join(", ")} à sessão de ${formatDay(s.date)}`,
        });
      }
    });
    return {};
  });
  if (r.ok) done(sessionId);
  return r;
}

export async function removeSessionPlayer(sessionPlayerId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await db.$transaction(async (tx) => {
      const ctx = await lockBySessionPlayer(tx, sessionPlayerId);
      await tx.sessionPlayer.delete({ where: { id: sessionPlayerId } });
      await annulAdjustmentIfAny(tx, ctx.sessionId, ctx.locked, viewer);
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "session.removePlayer",
        entityType: "sessionPlayer",
        entityId: sessionPlayerId,
        summary: `${viewer.name} tirou ${ctx.playerName} da sessão de ${ctx.day}`,
      });
    });
    return {};
  });
  if (r.ok) done();
  return r;
}

/** Rebuy (ou novo buy-in) com o valor indicado em cêntimos. */
export async function addBuyIn(sessionPlayerId: string, amount: number): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    if (!isValidAmount(amount)) throw new UserError("O valor tem de ser maior que zero.");
    await db.$transaction(async (tx) => {
      const ctx = await lockBySessionPlayer(tx, sessionPlayerId);
      const b = await tx.buyIn.create({ data: { sessionPlayerId, amount }, select: { id: true } });
      await annulAdjustmentIfAny(tx, ctx.sessionId, ctx.locked, viewer);
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "buyin.add",
        entityType: "buyin",
        entityId: b.id,
        summary: `${viewer.name} registou entrada de ${formatCents(amount)} para ${ctx.playerName} (${ctx.day})`,
      });
    });
    return {};
  });
  if (r.ok) done();
  return r;
}

/** Remover uma entrada registada por engano. */
export async function removeBuyIn(buyInId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await db.$transaction(async (tx) => {
      const b = await tx.buyIn.findUnique({ where: { id: buyInId }, select: { sessionPlayerId: true, amount: true } });
      if (!b) throw new UserError("Esta entrada já não existe.");
      const ctx = await lockBySessionPlayer(tx, b.sessionPlayerId);
      await tx.buyIn.delete({ where: { id: buyInId } });
      await annulAdjustmentIfAny(tx, ctx.sessionId, ctx.locked, viewer);
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "buyin.remove",
        entityType: "buyin",
        entityId: buyInId,
        summary: `${viewer.name} removeu entrada de ${formatCents(b.amount)} de ${ctx.playerName} (${ctx.day})`,
      });
    });
    return {};
  });
  if (r.ok) done();
  return r;
}

/** Cash-out final (cêntimos); null limpa o valor. */
export async function setCashOut(sessionPlayerId: string, amount: number | null): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    if (amount !== null && !isValidAmount(amount, true)) throw new UserError("Valor de cash-out inválido.");
    await db.$transaction(async (tx) => {
      const ctx = await lockBySessionPlayer(tx, sessionPlayerId);
      await tx.sessionPlayer.update({ where: { id: sessionPlayerId }, data: { cashOut: amount } });
      await annulAdjustmentIfAny(tx, ctx.sessionId, ctx.locked, viewer);
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "cashout.set",
        entityType: "sessionPlayer",
        entityId: sessionPlayerId,
        summary:
          amount === null
            ? `${viewer.name} limpou o cash-out de ${ctx.playerName} (${ctx.day})`
            : `${viewer.name} registou cash-out de ${formatCents(amount)} para ${ctx.playerName} (${ctx.day})`,
      });
    });
    return {};
  });
  if (r.ok) done();
  return r;
}

export type ReconcileRequest = {
  method: ReconcileMethod;
  singlePlayerId?: string | null;
  /** D que o utilizador viu ao confirmar: se mudou entretanto, recusa */
  expectedDiscrepancy: number;
  /** PIN de admin, exigido quando |D| passa os limites suaves */
  pin?: string;
};

/** Confirmar o ajuste de uma diferença de contagem. Permissões validadas aqui, no servidor. */
export async function reconcileSession(sessionId: string, req: ReconcileRequest): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    if (!isReconcileMethod(req?.method)) throw new UserError("Escolhe um método de ajuste válido.");
    await db.$transaction(async (tx) => {
      const s = await lockOpenSession(tx, sessionId);
      if (s.reconciledAt) throw new UserError("Esta sessão já tem um ajuste. Desfaz o ajuste atual primeiro.");
      const players = await tx.sessionPlayer.findMany({
        where: { sessionId },
        select: { id: true, cashOut: true, player: { select: { name: true } }, buyIns: { select: { amount: true } } },
      });
      const inputs = players.map((p) => ({ id: p.id, buyInTotal: p.buyIns.reduce((a, b) => a + b.amount, 0), cashOut: p.cashOut }));
      const singleSp = req.method === "SINGLE_PLAYER" ? players.find((p) => p.id === req.singlePlayerId) : undefined;
      let result;
      try {
        result = reconcile({ players: inputs, method: req.method, singlePlayerId: req.singlePlayerId });
      } catch (e) {
        if (e instanceof ReconcileError) throw new UserError(e.message);
        throw e;
      }
      const D = result.discrepancy;
      if (D === 0) throw new UserError("A contagem bate certo: não há diferença para ajustar.");
      if (D !== req.expectedDiscrepancy) {
        throw new UserError("Os valores da sessão mudaram entretanto. Revê a diferença e confirma de novo.", "stale");
      }
      const totalIn = inputs.reduce((a, p) => a + p.buyInTotal, 0);
      if (exceedsSoftLimit(D, totalIn) && !(await isAdmin()) && !checkAdminPin(String(req.pin ?? ""))) {
        throw new UserError("A diferença passa o limite: só o admin pode confirmar este ajuste (PIN inválido ou em falta).", "needs_admin");
      }
      for (const a of result.adjustments) {
        await tx.sessionPlayer.update({ where: { id: a.id }, data: { adjustment: a.adjustment } });
      }
      const singlePlayer = singleSp ? await tx.sessionPlayer.findUnique({ where: { id: singleSp.id }, select: { playerId: true } }) : null;
      await tx.session.update({
        where: { id: sessionId },
        data: {
          discrepancy: D,
          adjustmentMethod: req.method,
          adjustmentPlayerId: singlePlayer?.playerId ?? null,
          reconciledAt: new Date(),
          reconciledByPlayerId: viewer.id,
        },
      });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "adjustment.apply",
        entityType: "session",
        entityId: sessionId,
        summary: `${viewer.name} ajustou a diferença de contagem (${D > 0 ? "sobravam" : "faltavam"} ${formatCents(D)}, D = ${D} cêntimos) com o método ${
          METHOD_LABELS[req.method]
        }${singleSp ? ` (${singleSp.player.name})` : ""} — ${formatDay(s.date)}`,
      });
    });
    return {};
  });
  if (r.ok) done(sessionId);
  return r;
}

/** Desfazer o ajuste (só com a sessão em aberto). */
export async function undoReconcile(sessionId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await db.$transaction(async (tx) => {
      const s = await lockOpenSession(tx, sessionId);
      if (!s.reconciledAt) throw new UserError("Esta sessão não tem nenhum ajuste para desfazer.");
      await clearAdjustment(tx, sessionId);
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "adjustment.undo",
        entityType: "session",
        entityId: sessionId,
        summary: `${viewer.name} desfez o ajuste de contagem (${s.adjustmentMethod ? METHOD_LABELS[s.adjustmentMethod] : "?"}, D = ${
          s.discrepancy ?? 0
        } cêntimos) — ${formatDay(s.date)}`,
      });
    });
    return {};
  });
  if (r.ok) done(sessionId);
  return r;
}

/** Apagar uma sessão em aberto (só admin). Jogadores e entradas da sessão saem em cascata. */
export async function deleteSession(sessionId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await requireAdmin();
    await db.$transaction(async (tx) => {
      // Também recusa sessões já ligadas a um fecho: essas nunca podem ser alteradas.
      const s = await lockOpenSession(tx, sessionId);
      const players = await tx.sessionPlayer.findMany({
        where: { sessionId },
        select: { player: { select: { name: true } }, buyIns: { select: { amount: true } } },
      });
      const pot = players.reduce((a, p) => a + p.buyIns.reduce((b, x) => b + x.amount, 0), 0);
      await tx.session.delete({ where: { id: sessionId } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "session.delete",
        entityType: "session",
        entityId: sessionId,
        summary: `${viewer.name} (admin) apagou a sessão de ${formatDay(s.date)} (${players.length} jogadores: ${
          players.map((p) => p.player.name).join(", ") || "nenhum"
        }; pote ${formatCents(pot)})`,
      });
    });
    return {};
  });
  if (r.ok) {
    done();
    redirect("/sessoes");
  }
  return r;
}
