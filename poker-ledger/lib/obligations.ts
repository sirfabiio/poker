// Contas por saldar dentro de um grupo: só LÊ os cálculos existentes (getOpenState e transferências),
// para bloquear sair, remover e apagar. Nunca altera saldos nem transferências.
import { db } from "./db";
import { formatCents } from "./money";
import { formatDay } from "./format";
import { getOpenState } from "./queries";

type Line = { otherName: string; amount: number; where: string };

export type Obligations = {
  /** o jogador deve a outros */
  owes: Line[];
  /** outros devem ao jogador */
  owed: Line[];
  /** está numa sessão em aberto sem cash-out ou com diferença por ajustar (o resultado ainda pode mudar) */
  pendingSessions: string[];
};

const EMPTY: Obligations = { owes: [], owed: [], pendingSessions: [] };

/** Contas por saldar de cada membro do grupo (transferências não pagas + sessões ainda não fechadas). */
export async function groupObligations(groupId: string): Promise<Map<string, Obligations>> {
  const [open, unpaid] = await Promise.all([
    getOpenState(groupId),
    db.transfer.findMany({
      where: { paid: false, settlement: { groupId } },
      select: {
        amount: true,
        fromPlayerId: true,
        toPlayerId: true,
        from: { select: { name: true } },
        to: { select: { name: true } },
        settlement: { select: { label: true } },
      },
    }),
  ]);
  const pendingRows = open.invalid.length
    ? await db.sessionPlayer.findMany({
        where: { sessionId: { in: open.invalid.map((s) => s.id) }, session: { groupId } },
        select: { playerId: true, sessionId: true },
      })
    : [];

  const out = new Map<string, Obligations>();
  const get = (id: string) => {
    let o = out.get(id);
    if (!o) out.set(id, (o = { owes: [], owed: [], pendingSessions: [] }));
    return o;
  };
  for (const t of unpaid) {
    const where = `fecho “${t.settlement.label}”`;
    get(t.fromPlayerId).owes.push({ otherName: t.to.name, amount: t.amount, where });
    get(t.toPlayerId).owed.push({ otherName: t.from.name, amount: t.amount, where });
  }
  const name = (id: string) => open.players.get(id)?.name ?? "?";
  for (const t of open.preview) {
    const where = "sessões ainda não fechadas";
    get(t.fromPlayerId).owes.push({ otherName: name(t.toPlayerId), amount: t.amount, where });
    get(t.toPlayerId).owed.push({ otherName: name(t.fromPlayerId), amount: t.amount, where });
  }
  const dates = new Map(open.invalid.map((s) => [s.id, formatDay(s.date)]));
  for (const r of pendingRows) get(r.playerId).pendingSessions.push(dates.get(r.sessionId) ?? "?");
  return out;
}

export async function memberObligations(groupId: string, playerId: string): Promise<Obligations> {
  return (await groupObligations(groupId)).get(playerId) ?? EMPTY;
}

export const hasObligations = (o: Obligations) => o.owes.length + o.owed.length + o.pendingSessions.length > 0;

/** Frases para mostrar o bloqueio. `who` = "eu" (o próprio) ou o nome da pessoa. */
export function describeObligations(o: Obligations, who: "eu" | string): string[] {
  const me = who === "eu";
  return [
    ...o.owes.map((l) => `${me ? "Deves" : `${who} deve`} ${formatCents(l.amount)} a ${l.otherName} (${l.where}).`),
    ...o.owed.map((l) => `${l.otherName} ${me ? "deve-te" : `deve a ${who}`} ${formatCents(l.amount)} (${l.where}).`),
    ...o.pendingSessions.map((d) => `${me ? "Estás" : `${who} está`} na sessão de ${d}, que ainda não tem as contas certas (falta um cash-out ou ajustar a diferença).`),
  ];
}

/** O que impede apagar o grupo: transferências por pagar ou sessões ainda não fechadas com jogadores. */
export async function groupDeleteBlockers(groupId: string): Promise<string[]> {
  const [unpaid, openSessions] = await Promise.all([
    db.transfer.findMany({
      where: { paid: false, settlement: { groupId } },
      select: { amount: true, from: { select: { name: true } }, to: { select: { name: true } }, settlement: { select: { label: true } } },
      orderBy: { amount: "desc" },
    }),
    db.session.findMany({
      where: { groupId, settlementId: null, players: { some: {} } },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
  ]);
  const lines = unpaid.map((t) => `${t.from.name} ainda não pagou ${formatCents(t.amount)} a ${t.to.name} (fecho “${t.settlement.label}”).`);
  if (openSessions.length > 0) {
    const n = openSessions.length;
    lines.push(
      `${n === 1 ? "Há 1 sessão" : `Há ${n} sessões`} por fechar nas contas (${openSessions.map((s) => formatDay(s.date)).join(", ")}). Fecha as contas ou apaga as sessões em aberto primeiro.`,
    );
  }
  return lines;
}
