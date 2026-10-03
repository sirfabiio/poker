"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { requirePlayer } from "../identity";
import { isAdmin, requireAdmin } from "../admin";
import { logActivity } from "../activity";
import { summarizeOpen } from "../ledger";
import { computeTransfers, SettlementError } from "../settle";
import { formatCents } from "../money";
import { formatDay, monthLabel } from "../format";

/** Fechar contas: junta TODAS as sessões em aberto, calcula saldos e gera transferências. Só admin. */
export async function closeAccounts(_: unknown, form: FormData): Promise<ActionResult> {
  let settlementId = "";
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await requireAdmin();
    const label = String(form.get("label") ?? "").trim().slice(0, 60) || monthLabel(new Date());

    settlementId = await db.$transaction(
      async (tx) => {
        // Bloqueia as sessões em aberto para nenhuma ser editada a meio do fecho.
        await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "settlementId" IS NULL FOR UPDATE`;
        const sessions = await tx.session.findMany({
          where: { settlementId: null },
          select: {
            id: true,
            date: true,
            reconciledAt: true,
            players: { select: { playerId: true, cashOut: true, adjustment: true, buyIns: { select: { amount: true } } } },
          },
        });
        if (sessions.length === 0) throw new UserError("Não há sessões em aberto para fechar.");

        const summary = summarizeOpen(
          sessions.map((s) => ({
            id: s.id,
            date: s.date,
            reconciled: s.reconciledAt !== null,
            players: s.players.map((p) => ({
              playerId: p.playerId,
              cashOut: p.cashOut,
              adjustment: p.adjustment,
              buyIns: p.buyIns.map((b) => b.amount),
            })),
          })),
        );
        if (summary.invalid.length > 0) {
          const list = summary.invalid.map((s) => formatDay(s.date)).join("; ");
          throw new UserError(`Não é possível fechar: há sessões por acertar (${list}).`, "invalid_sessions");
        }

        const balances = [...summary.balances].map(([playerId, amount]) => ({ playerId, amount }));
        const total = balances.reduce((s, b) => s + b.amount, 0);
        if (total !== 0) throw new UserError(`Erro: a soma dos saldos não é zero (${total} cêntimos). Fecho abortado.`);
        let plan;
        try {
          plan = computeTransfers(balances);
        } catch (e) {
          if (e instanceof SettlementError) throw new UserError(`Fecho abortado: ${e.message}`);
          throw e;
        }

        const st = await tx.settlement.create({
          data: { label, transfers: { create: plan } },
          select: { id: true },
        });
        await tx.session.updateMany({ where: { id: { in: summary.validIds } }, data: { settlementId: st.id } });
        await logActivity(tx, {
          actorPlayerId: viewer.id,
          action: "settlement.close",
          entityType: "settlement",
          entityId: st.id,
          summary: `${viewer.name} (admin) fechou as contas "${label}": ${sessions.length} sessões, ${plan.length} transferências`,
        });
        return st.id;
      },
      { timeout: 15000 },
    );
    return {};
  });
  if (r.ok) {
    revalidatePath("/", "layout");
    redirect(`/contas/${settlementId}`);
  }
  return r;
}

/** Marcar transferência como paga (ou desfazer). Pagador, recebedor ou admin. */
export async function setTransferPaid(transferId: string, paid: boolean): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const t = await db.transfer.findUnique({
      where: { id: transferId },
      select: { fromPlayerId: true, toPlayerId: true, amount: true, from: { select: { name: true } }, to: { select: { name: true } } },
    });
    if (!t) throw new UserError("Transferência não encontrada.");
    const involved = t.fromPlayerId === viewer.id || t.toPlayerId === viewer.id;
    if (!involved && !(await isAdmin())) {
      throw new UserError("Só quem paga, quem recebe ou o admin pode marcar esta transferência.", "forbidden");
    }
    await db.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id: transferId },
        data: { paid: Boolean(paid), paidAt: paid ? new Date() : null },
      });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: paid ? "transfer.paid" : "transfer.unpaid",
        entityType: "transfer",
        entityId: transferId,
        summary: `${viewer.name} marcou como ${paid ? "paga" : "por pagar"}: ${t.from.name} → ${t.to.name} (${formatCents(t.amount)})`,
      });
    });
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

