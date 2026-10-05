// Leituras por página: só os campos necessários, sem N+1.
import { createHash } from "node:crypto";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import type { StatsSessionInput } from "./stats";
import { STATS_MAX_AGE_SECONDS, STATS_TAG } from "./config";
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
        reconciledAt: true,
        players: { select: { playerId: true, cashOut: true, adjustment: true, buyIns: { select: { amount: true } } } },
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
    reconciled: s.reconciledAt !== null,
    players: s.players.map((p) => ({
      playerId: p.playerId,
      cashOut: p.cashOut,
      adjustment: p.adjustment,
      buyIns: p.buyIns.map((b) => b.amount),
    })),
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
      check: checkSession(s.players, s.reconciled),
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
  /** soma dos ajustes de contagem */
  adj: number;
  reconciled: boolean;
};

/** Lista de sessões com totais numa única query. */
export function getSessionRows() {
  return db.$queryRaw<SessionRow[]>`
    SELECT s."id", s."date", s."settlementId", st."label",
      (s."reconciledAt" IS NOT NULL) AS "reconciled",
      COALESCE(sp."adj", 0)::int AS "adj",
      COALESCE(sp."players", 0)::int AS "players",
      COALESCE(sp."out", 0)::int AS "out",
      COALESCE(sp."missing", 0)::int AS "missing",
      COALESCE(b."pot", 0)::int AS "pot"
    FROM "Session" s
    LEFT JOIN "Settlement" st ON st."id" = s."settlementId"
    LEFT JOIN (
      SELECT "sessionId", COUNT(*) AS "players", SUM("cashOut") AS "out", SUM("adjustment") AS "adj",
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
      version: true,
      discrepancy: true,
      adjustmentMethod: true,
      reconciledAt: true,
      reconciledBy: { select: { name: true } },
      adjustmentPlayer: { select: { name: true } },
      settlement: { select: { id: true, label: true } },
      createdBy: { select: { name: true } },
      players: {
        orderBy: { player: { name: "asc" } },
        select: {
          id: true,
          playerId: true,
          cashOut: true,
          adjustment: true,
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
        adjustment: true,
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
      adjustment: r.adjustment,
      net: playerNet({ playerId, cashOut: r.cashOut, adjustment: r.adjustment, buyIns: r.buyIns.map((b) => b.amount) }),
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


type StatsRow = {
  sessionId: string;
  date: Date;
  reconciled: boolean;
  playerId: string;
  name: string;
  avatarColor: string;
  active: boolean;
  cashOut: number | null;
  adjustment: number;
  buyInTotal: number;
  buyInCount: number;
};

/**
 * Todas as sessões para o ranking numa ÚNICA query (sessão × jogador, com soma e contagem de entradas).
 * Usa os índices existentes: SessionPlayer(sessionId, playerId) e BuyIn(sessionPlayerId).
 * O resultado fica em cache (datas como texto, porque a cache serializa em JSON) até revalidateTag(STATS_TAG).
 */
const loadStatsRows = unstable_cache(
  async () => {
    const rows = await db.$queryRaw<StatsRow[]>`
      SELECT s."id" AS "sessionId", s."date", (s."reconciledAt" IS NOT NULL) AS "reconciled",
        sp."playerId", p."name", p."avatarColor", p."active", sp."cashOut", sp."adjustment",
        COALESCE(SUM(b."amount"), 0)::int AS "buyInTotal", COUNT(b."id")::int AS "buyInCount"
      FROM "Session" s
      JOIN "SessionPlayer" sp ON sp."sessionId" = s."id"
      JOIN "Player" p ON p."id" = sp."playerId"
      LEFT JOIN "BuyIn" b ON b."sessionPlayerId" = sp."id"
      GROUP BY s."id", sp."id", p."id"
      ORDER BY s."date", s."createdAt", s."id"`;
    return rows.map((r) => ({ ...r, date: r.date.toISOString() }));
  },
  // A chave inclui uma impressão da base de dados (hash, nunca a URL): deployments ligados a bases
  // diferentes (ex.: preview com a branch dev) nunca partilham entradas da cache.
  ["stats-rows-v1", createHash("sha256").update(process.env.DATABASE_URL ?? "").digest("hex").slice(0, 16)],
  // A tag é invalidada em todas as escritas da app; os 10 min são só uma rede de segurança para
  // alterações feitas fora da app (ex.: apagar dados de teste no SQL Editor do Neon).
  { tags: [STATS_TAG], revalidate: STATS_MAX_AGE_SECONDS },
);

export const getStatsSessions = cache(async (): Promise<StatsSessionInput[]> => {
  const rows = await loadStatsRows();
  const out: StatsSessionInput[] = [];
  const byId = new Map<string, StatsSessionInput & { players: StatsSessionInput["players"][number][] }>();
  for (const r of rows) {
    let s = byId.get(r.sessionId);
    if (!s) {
      s = { id: r.sessionId, date: new Date(r.date), reconciled: r.reconciled, players: [] };
      byId.set(r.sessionId, s);
      out.push(s);
    }
    s.players.push({
      playerId: r.playerId,
      name: r.name,
      avatarColor: r.avatarColor,
      active: r.active,
      cashOut: r.cashOut,
      adjustment: r.adjustment,
      buyInTotal: r.buyInTotal,
      buyInCount: r.buyInCount,
    });
  }
  return out;
});
