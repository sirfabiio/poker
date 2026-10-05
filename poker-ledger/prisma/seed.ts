// Dados de exemplo SÓ para desenvolvimento: 5 jogadores e 3 sessões.
// Nunca corre no build. Recusa correr em produção ou numa base de dados com dados.
import { PrismaClient } from "@prisma/client";
import { nameKey } from "../lib/players";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("O seed de exemplo é só para desenvolvimento. Nada foi feito.");
  process.exit(1);
}

const db = new PrismaClient();

const PLAYERS = [
  { name: "Rui", avatarColor: "red", ibanOrMbway: "MB WAY 912 345 678" },
  { name: "Ana", avatarColor: "blue", ibanOrMbway: "PT50 0000 0000 0000 0000 0000 0" },
  { name: "Miguel", avatarColor: "gold", ibanOrMbway: null },
  { name: "Sofia", avatarColor: "green", ibanOrMbway: "MB WAY 961 234 567" },
  { name: "Tiago", avatarColor: "ink", ibanOrMbway: null },
];

// [jogador, buy-ins (cêntimos), cash-out (cêntimos) | null, ajuste de contagem (cêntimos)]
type Row = [string, number[], number | null, number?];
const SESSIONS: { date: string; notes?: string; adjusted?: number; rows: Row[] }[] = [
  {
    date: "2026-09-12",
    notes: "Casa do Rui",
    rows: [
      ["Rui", [2000], 4550],
      ["Ana", [2000, 2000], 1200],
      ["Miguel", [2000], 4250],
      ["Sofia", [2000], 0],
    ],
  },
  {
    date: "2026-09-26",
    rows: [
      ["Ana", [2000], 5300],
      ["Miguel", [2000, 2000], 0],
      ["Sofia", [2000], 2700],
      ["Tiago", [2000, 1000], 3000],
    ],
  },
  {
    date: "2026-10-02",
    notes: "Sobraram 3 € na contagem (ajuste igual por todos)",
    adjusted: 300,
    rows: [
      ["Rui", [2000, 2000], 3100, -100],
      ["Ana", [2000], 1500, -100],
      ["Tiago", [2000], 3700, -100],
    ],
  },
];

async function main() {
  if ((await db.player.count()) > 0) {
    console.error("A base de dados já tem jogadores. O seed só corre numa base de dados vazia.");
    process.exit(1);
  }

  const ids = new Map<string, string>();
  for (const p of PLAYERS) {
    const created = await db.player.create({ data: { ...p, nameKey: nameKey(p.name) } });
    ids.set(p.name, created.id);
    await db.activityLog.create({
      data: {
        actorPlayerId: created.id,
        action: "player.create",
        entityType: "player",
        entityId: created.id,
        summary: `${p.name} criou o seu perfil (seed)`,
      },
    });
  }

  const rui = ids.get("Rui")!;
  for (const s of SESSIONS) {
    const session = await db.session.create({
      data: {
        date: new Date(`${s.date}T00:00:00Z`),
        notes: s.notes,
        defaultBuyIn: 2000,
        createdByPlayerId: rui,
        ...(s.adjusted
          ? { discrepancy: s.adjusted, adjustmentMethod: "EQUAL" as const, reconciledAt: new Date(), reconciledByPlayerId: rui }
          : {}),
        players: {
          create: s.rows.map(([name, buyIns, cashOut, adjustment]) => ({
            playerId: ids.get(name)!,
            cashOut,
            adjustment: adjustment ?? 0,
            buyIns: { create: buyIns.map((amount) => ({ amount })) },
          })),
        },
      },
    });
    await db.activityLog.create({
      data: {
        actorPlayerId: rui,
        action: "session.create",
        entityType: "session",
        entityId: session.id,
        summary: `Rui criou a sessão de ${s.date} (seed)`,
      },
    });
  }

  console.log(`Seed concluído: ${PLAYERS.length} jogadores e ${SESSIONS.length} sessões.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
