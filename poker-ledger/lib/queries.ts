// Leituras por página: só os campos necessários, sem N+1.
import { cache } from "react";
import { db } from "./db";
import { checkSession, playerNet, summarizeOpen, type SessionCheck } from "./ledger";
import { computeTransfers, type PlannedTransfer } from "./settle";

export type PlayerLite = { id: string; name: string; avatarColor: string; active: boolean };

export type OpenState = {
  players: Map<string, PlayerLite>;
  ranking: (PlayerLite & { balance: number })[];
  sessions: { id: string; date: Date; notes: string | null; playerCount: number; check: SessionCheck }[];
  invalid: { id: string; date: Date; check: SessionCheck }[];
  preview: PlannedTransfer[];
};

/** Saldos em aberto de todos: UMA função, duas queries em paralelo, agregação em memória. */
export const getOpenState = cache(async (): Promise<OpenState> => {
  const [sessions, players] = await Promise.all([
    db.session.findMany({
      where: { settlementId: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        notes: true,
        players: { select: { playerId: true, cashOut: true, buyIns: { select: { amount: true } } } },
      },
    }),
    db.player.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarColor: true, active: true },
    }),
  ]);

  const inputs = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    players: s.players.map((p) => ({ playerId: p.playerId, cashOut: p.cashOut, buyIns: p.buyIns.map((b) => b.amount) })),
  }));
  const summary = summarizeOpen(inputs);
  const byId = new Map(players.map((p) => [p.id, p]));

  const ranking = players
    .map((p) => ({ ...p, balance: summary.balances.get(p.id) ?? 0 }))
    .filter((p) => p.active || p.balance !== 0)
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "pt"));

  let preview: PlannedTransfer[] = [];
  try {
    preview = computeTransfers([...summary.balances].map(([playerId, amount]) => ({ playerId, amount })));
  } catch {
    preview = [];
  }

  return {
    players: byId,
    ranking,
    sessions: inputs.map((s, i) => ({
      id: s.id,
      date: s.date,
      notes: sessions[i].notes,
      playerCount: s.players.length,
      check: checkSession(s.players),
    })),
    invalid: summary.invalid,
    preview,
  };
});

export function getSettlements(take?: number) {
  return db.settlement.findMany({
    orderBy: { closedAt: "desc" },
    take,
    select: {
      id: true,
      label: true,
      closedAt: true,
      _count: { select: { transfers: true, sessions: true } },
      transfers: { where: { paid: true }, select: { id: true } },
    },
  });
}

export type SessionRow = {
  id: string;
  date: Date;
  settlementId: string | null;
  label: string | null;
  players: number;
  pot: number;
  out: number;
  missing: number;
};

/** Lista de sessões com totais numa única query. */
export function getSessionRows() {
  return db.$queryRaw<SessionRow[]>`
    SELECT s."id", s."date", s."settlementId", st."label",
      COALESCE(sp."players", 0)::int AS "players",
      COALESCE(sp."out", 0)::int AS "out",
      COALESCE(sp."missing", 0)::int AS "missing",
      COALESCE(b."pot", 0)::int AS "pot"
    FROM "Session" s
    LEFT JOIN "Settlement" st ON st."id" = s."settlementId"
    LEFT JOIN (
      SELECT "sessionId", COUNT(*) AS "players", SUM("cashOut") AS "out",
             COUNT(*) FILTER (WHERE "cashOut" IS NULL) AS "missing"
      FROM "SessionPlayer" GROUP BY "sessionId"
    ) sp ON sp."sessionId" = s."id"
    LEFT JOIN (
      SELECT x."sessionId", SUM(y."amount") AS "pot"
      FROM "SessionPlayer" x JOIN "BuyIn" y ON y."sessionPlayerId" = x."id"
      GROUP BY x."sessionId"
    ) b ON b."sessionId" = s."id"
    ORDER BY (s."settlementId" IS NULL) DESC, s."date" DESC, s."createdAt" DESC`;
}

export function getActivePlayers() {
  return db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarColor: true },
  });
}

export function getSessionDetail(id: string) {
  return db.session.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      notes: true,
      defaultBuyIn: true,
      settlement: { select: { id: true, label: true } },
      createdBy: { select: { name: true } },
      players: {
        orderBy: { player: { name: "asc" } },
        select: {
          id: true,
          playerId: true,
          cashOut: true,
          player: { select: { name: true, avatarColor: true } },
          buyIns: { orderBy: { createdAt: "asc" }, select: { id: true, amount: true } },
        },
      },
    },
  });
}

export function getSettlementDetail(id: string) {
  const party = { select: { id: true, name: true, avatarColor: true } } as const;
  return db.settlement.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      closedAt: true,
      _count: { select: { sessions: true } },
      transfers: {
        orderBy: [{ paid: "asc" }, { amount: "desc" }],
        select: {
          id: true,
          amount: true,
          paid: true,
          paidAt: true,
          from: party,
          to: { select: { id: true, name: true, avatarColor: true, ibanOrMbway: true } },
        },
      },
    },
  });
}

/** Perfil: histórico por sessão e transferências pendentes. */
export async function getMyHistory(playerId: string) {
  const [rows, pending] = await Promise.all([
    db.sessionPlayer.findMany({
      where: { playerId },
      orderBy: { session: { date: "desc" } },
      take: 60,
      select: {
        cashOut: true,
        buyIns: { select: { amount: true } },
        session: { select: { id: true, date: true, settlementId: true } },
      },
    }),
    db.transfer.findMany({
      where: { paid: false, OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }] },
      orderBy: { settlement: { closedAt: "desc" } },
      select: {
        id: true,
        amount: true,
        settlementId: true,
        settlement: { select: { label: true } },
        from: { select: { id: true, name: true, avatarColor: true } },
        to: { select: { id: true, name: true, avatarColor: true } },
      },
    }),
  ]);
  return {
    sessions: rows.map((r) => ({
      id: r.session.id,
      date: r.session.date,
      open: r.session.settlementId === null,
      complete: r.cashOut !== null,
      net: playerNet({ playerId, cashOut: r.cashOut, buyIns: r.buyIns.map((b) => b.amount) }),
    })),
    pending,
  };
}

export const ACTIVITY_PAGE_SIZE = 20;

export async function getActivityPage(page: number) {
  const rows = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ACTIVITY_PAGE_SIZE,
    take: ACTIVITY_PAGE_SIZE + 1,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true, avatarColor: true } },
    },
  });
  return { rows: rows.slice(0, ACTIVITY_PAGE_SIZE), hasNext: rows.length > ACTIVITY_PAGE_SIZE };
}

export function getAllPlayers() {
  return db.player.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, avatarColor: true, active: true },
  });
}
