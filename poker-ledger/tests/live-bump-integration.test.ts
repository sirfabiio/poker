// Integração com Postgres real: cada escrita sobe Session.version NA MESMA TRANSAÇÃO.
// Só corre com TEST_DATABASE_URL a apontar para uma BD cujo nome termina em "_test" (apaga tudo nessa BD!).
//   TEST_DATABASE_URL=postgresql://…/poker_test npm test
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "";
const enabled = /\/[^/?]+_test(\?|$)/.test(TEST_URL);

const jar = new Map<string, string>();
const flags = { failLog: false };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n) } : undefined),
    set: (n: string, v: string) => jar.set(n, v),
    delete: (n: string) => jar.delete(n),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), redirect: vi.fn() }));
// Falha simulada DEPOIS do bump (o logActivity vem a seguir em todas as ações): prova que a versão faz rollback.
vi.mock("@/lib/activity", async (orig) => {
  const m = await orig<typeof import("@/lib/activity")>();
  return {
    ...m,
    logActivity: async (...a: Parameters<typeof m.logActivity>) => {
      if (flags.failLog) throw new Error("falha simulada a meio da transação");
      return m.logActivity(...a);
    },
  };
});

describe.skipIf(!enabled)("Session.version sobe na mesma transação de cada escrita", () => {
  let db: typeof import("@/lib/db").db;
  let A: typeof import("@/lib/actions/sessions");
  let S: typeof import("@/lib/actions/settlements");
  let bump: typeof import("@/lib/live/bump").bumpSessionVersion;
  let ana = "";
  let bea = "";
  let cai = "";
  let sid = "";
  let sid2 = "";
  const sp = async (sessionId: string, playerId: string) =>
    (await db.sessionPlayer.findUniqueOrThrow({ where: { sessionId_playerId: { sessionId, playerId } } })).id;
  const ver = (id = sid) =>
    db.session.findUniqueOrThrow({ where: { id }, select: { version: true, lastChangeType: true, lastActorPlayerId: true } });

  /** Corre a ação com falha depois do bump (versão igual) e depois a sério (versão +1, tipo e autor certos). */
  async function expectBump(type: string, fn: () => Promise<{ ok: boolean }>, ids = [sid]) {
    const before = await Promise.all(ids.map((id) => ver(id)));
    flags.failLog = true;
    const failed = await fn();
    flags.failLog = false;
    expect(failed.ok).toBe(false);
    for (const [i, id] of ids.entries()) expect((await ver(id)).version).toBe(before[i].version);
    const r = await fn();
    expect(r.ok).toBe(true);
    for (const [i, id] of ids.entries()) {
      expect(await ver(id)).toEqual({ version: before[i].version + 1, lastChangeType: type, lastActorPlayerId: ana });
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    process.env.ADMIN_PIN = "135790";
    vi.spyOn(console, "error").mockImplementation(() => {});
    ({ db } = await import("@/lib/db"));
    A = await import("@/lib/actions/sessions");
    S = await import("@/lib/actions/settlements");
    ({ bumpSessionVersion: bump } = await import("@/lib/live/bump"));
    const { makeAdminToken } = await import("@/lib/admin");
    await db.$executeRawUnsafe(
      `TRUNCATE "Transfer", "Settlement", "ActivityLog", "BuyIn", "SessionPlayer", "Session", "Player" CASCADE`,
    );
    const mk = (name: string) => db.player.create({ data: { name, nameKey: name.toLowerCase(), avatarColor: "#B3202A" } });
    [ana, bea, cai] = (await Promise.all([mk("Ana"), mk("Bea"), mk("Cai")])).map((p) => p.id);
    jar.set("pl_player", ana);
    jar.set("pl_admin", makeAdminToken("135790"));
    for (const notes of ["s1", "s2"]) {
      const r = await A.createSession({ date: "2026-10-01", defaultBuyIn: 2000, playerIds: [ana, bea], notes });
      expect(r.ok).toBe(true);
    }
    sid = (await db.session.findFirstOrThrow({ where: { notes: "s1" } })).id;
    sid2 = (await db.session.findFirstOrThrow({ where: { notes: "s2" } })).id;
    expect((await ver()).version).toBe(0);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("rebuy_added: addBuyIn", async () => {
    await expectBump("rebuy_added", async () => A.addBuyIn(await sp(sid, ana), 1000));
  });

  it("rebuy_removed: removeBuyIn", async () => {
    const b = await db.buyIn.findFirstOrThrow({ where: { amount: 1000 } });
    await expectBump("rebuy_removed", () => A.removeBuyIn(b.id));
  });

  it("cashout_set: setCashOut", async () => {
    await expectBump("cashout_set", async () => A.setCashOut(await sp(sid, ana), 2300));
  });

  it("player_added: addSessionPlayers", async () => {
    await expectBump("player_added", () => A.addSessionPlayers(sid, [cai]));
  });

  it("player_removed: removeSessionPlayer", async () => {
    const id = await sp(sid, cai);
    await expectBump("player_removed", () => A.removeSessionPlayer(id));
  });

  it("session_edited: updateSession", async () => {
    await expectBump("session_edited", () => A.updateSession(sid, { date: "2026-10-02", defaultBuyIn: 2500, notes: "s1" }));
  });

  it("adjustment_confirmed: reconcileSession (e um pedido recusado não sobe a versão)", async () => {
    await A.setCashOut(await sp(sid, bea), 2000); // entradas 40 €, cash-outs 43 € → D = +300
    const before = (await ver()).version;
    const stale = await A.reconcileSession(sid, { method: "EQUAL", expectedDiscrepancy: 999 });
    expect(stale.ok).toBe(false);
    expect((await ver()).version).toBe(before);
    await expectBump("adjustment_confirmed", () => A.reconcileSession(sid, { method: "EQUAL", expectedDiscrepancy: 300 }));
  });

  it("adjustment_undone: undoReconcile", async () => {
    await expectBump("adjustment_undone", () => A.undoReconcile(sid));
  });

  it("session_settled: closeAccounts sobe a versão de cada sessão fechada", async () => {
    await A.setCashOut(await sp(sid, ana), 2000); // D = 0
    await A.setCashOut(await sp(sid2, ana), 2000);
    await A.setCashOut(await sp(sid2, bea), 2000);
    const form = new FormData();
    form.set("label", "Teste");
    await expectBump("session_settled", () => S.closeAccounts(null, form), [sid, sid2]);
    expect((await db.session.findUniqueOrThrow({ where: { id: sid } })).settlementId).not.toBeNull();
  });

  it("escrita numa sessão fechada é recusada e não sobe a versão", async () => {
    const before = (await ver()).version;
    const r = await A.setCashOut(await sp(sid, ana), 100);
    expect(r.ok).toBe(false);
    expect((await ver()).version).toBe(before);
  });

  it("bumpSessionVersion numa transação que falha não deixa rasto", async () => {
    const before = (await ver(sid2)).version;
    await expect(
      db.$transaction(async (tx) => {
        await bump(tx, { sessionId: sid2, actorPlayerId: bea, type: "cashout_set" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await ver(sid2)).toMatchObject({ version: before, lastChangeType: "session_settled" });
  });
});
