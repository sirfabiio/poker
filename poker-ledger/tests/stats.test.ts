import { describe, expect, it } from "vitest";
import { computeStats, periodRange, shareText, sortRows, type StatsSessionInput, type Award } from "@/lib/stats";

const PLAYERS = {
  ana: { name: "Ana", avatarColor: "blue", active: true },
  bruno: { name: "Bruno", avatarColor: "red", active: true },
  carla: { name: "Carla", avatarColor: "gold", active: false }, // ex-jogadora: continua no ranking
  duarte: { name: "Duarte", avatarColor: "green", active: true },
};
type P = keyof typeof PLAYERS;
// [jogador, total de entradas (€), nº de BuyIns, cash-out (€) | null, ajuste (cêntimos)]
type R = [P, number, number, number | null, number?];
const S = (id: string, date: string, rows: R[], reconciled = false): StatsSessionInput => ({
  id,
  date: new Date(`${date}T00:00:00Z`),
  reconciled,
  players: rows.map(([p, inE, n, out, adj]) => ({
    playerId: p,
    ...PLAYERS[p],
    buyInTotal: inE * 100,
    buyInCount: n,
    cashOut: out === null ? null : out * 100,
    adjustment: adj ?? 0,
  })),
});

// Resultados líquidos (€) por sessão:
// S1 ana +30 bruno −10 carla −20 · S2 ana +10 bruno +20 carla −30 duarte 0 · S3 ana +5 bruno −25 carla +20
// S4 ana −40 bruno +15 carla +25 · S5 (ajustada, D=+3 €) ana +12 bruno −6 carla −6 · S6 ana +8 bruno −18 duarte +10
// S7 ana −20 bruno +50 carla −30 · S8 ana +15 bruno +5 carla −20
const DATA: StatsSessionInput[] = [
  S("s1", "2026-01-10", [["ana", 20, 1, 50], ["bruno", 20, 1, 10], ["carla", 20, 1, 0]]),
  S("s2", "2026-02-07", [["ana", 20, 1, 30], ["bruno", 40, 2, 60], ["carla", 60, 3, 30], ["duarte", 20, 1, 20]]),
  S("s3", "2026-03-07", [["ana", 20, 1, 25], ["bruno", 60, 3, 35], ["carla", 20, 1, 40]]),
  S("s4", "2026-04-04", [["ana", 60, 3, 20], ["bruno", 20, 1, 35], ["carla", 40, 2, 65]]),
  S("s5", "2026-05-02", [["ana", 20, 1, 33, -100], ["bruno", 20, 1, 15, -100], ["carla", 20, 1, 15, -100]], true),
  S("s6", "2026-06-06", [["ana", 20, 1, 28], ["bruno", 20, 1, 2], ["duarte", 20, 1, 30]]),
  S("s7", "2026-08-01", [["ana", 20, 1, 0], ["bruno", 60, 3, 110], ["carla", 40, 2, 10]]),
  S("s8", "2026-09-05", [["ana", 20, 1, 35], ["bruno", 20, 1, 25], ["carla", 20, 1, 0]]),
  // Incompleta (falta um cash-out) e com diferença sem ajuste: NUNCA contam
  S("inc", "2026-09-20", [["ana", 20, 1, 100], ["duarte", 20, 1, null]]),
  S("dif", "2026-09-25", [["ana", 20, 1, 30], ["duarte", 20, 1, 20]]),
];
const NOW = new Date("2026-10-05T12:00:00Z");
const stats = computeStats(DATA, { now: NOW });
const row = (id: string) => stats.rows.find((r) => r.playerId === id)!;
const award = (id: Award["id"]) => stats.awards.find((a) => a.id === id);

describe("computeStats: classificação", () => {
  it("só conta sessões válidas (incompleta e diferença por ajustar ignoradas)", () => {
    expect(stats.sessions.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
  });

  it("lucro total, sessões, investido e ROI de cada jogador", () => {
    expect([row("ana").profit, row("bruno").profit, row("carla").profit, row("duarte").profit]).toEqual([2000, 3100, -6100, 1000]);
    expect([row("ana").sessions, row("bruno").sessions, row("carla").sessions, row("duarte").sessions]).toEqual([8, 8, 7, 2]);
    expect([row("ana").invested, row("bruno").invested, row("carla").invested]).toEqual([20000, 26000, 22000]);
    expect(row("ana").roi).toBeCloseTo(0.1, 10);
    expect(row("bruno").roi).toBeCloseTo(3100 / 26000, 10);
    expect(row("carla").roi).toBeCloseTo(-6100 / 22000, 10);
    expect(row("ana").winRate).toBe(6 / 8);
    expect(row("ana").avg).toBe(250);
  });

  it("sessão ajustada: o ajuste conta no resultado", () => {
    // S5 sem ajuste daria ana +13 €; com ajuste −1 € dá +12 €
    const s5 = computeStats([DATA[4]], { now: NOW });
    expect(s5.rows.find((r) => r.playerId === "ana")!.profit).toBe(1200);
  });

  it("menos de MIN_SESSIONS_FOR_RATES sessões: sem média, % nem ROI", () => {
    expect(row("duarte").avg).toBeNull();
    expect(row("duarte").winRate).toBeNull();
    expect(row("duarte").roi).toBeNull();
  });

  it("a soma dos lucros totais é exatamente 0 (sempre e por período)", () => {
    expect(stats.totalProfit).toBe(0);
    expect(stats.rows.reduce((s, r) => s + r.profit, 0)).toBe(0);
    const p = computeStats(DATA, { from: new Date("2026-06-01T00:00:00Z"), now: NOW });
    expect(p.rows.reduce((s, r) => s + r.profit, 0)).toBe(0);
  });

  it("ordem por defeito: lucro; ex-jogadores incluídos", () => {
    expect(stats.rows.map((r) => r.playerId)).toEqual(["bruno", "ana", "duarte", "carla"]);
    expect(stats.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(row("carla").active).toBe(false);
  });

  it("desempates: média por sessão, depois nome", () => {
    const t = computeStats(
      [
        S("a", "2026-01-01", [["duarte", 20, 1, 30], ["carla", 20, 1, 10]]),
        S("b", "2026-01-02", [["ana", 20, 1, 25], ["bruno", 20, 1, 25], ["carla", 20, 1, 10]]),
        S("c", "2026-01-03", [["ana", 20, 1, 25], ["bruno", 20, 1, 25], ["carla", 20, 1, 10]]),
      ],
      { now: NOW },
    );
    // duarte +10 em 1 sessão; ana e bruno +10 em 2 sessões (média menor) → nome decide entre ana e bruno
    expect(t.rows.map((r) => r.playerId)).toEqual(["duarte", "ana", "bruno", "carla"]);
  });

  it("ordenação por coluna, com '—' no fim", () => {
    expect(sortRows(stats.rows, "media").map((r) => r.playerId)).toEqual(["bruno", "ana", "carla", "duarte"]);
    expect(sortRows(stats.rows, "investido")[0].playerId).toBe("bruno");
  });

  it("período filtrado", () => {
    const p = computeStats(DATA, { from: new Date("2026-06-01T00:00:00Z"), now: NOW });
    expect(p.sessions.map((s) => s.id)).toEqual(["s6", "s7", "s8"]);
    expect(Object.fromEntries(p.rows.map((r) => [r.playerId, r.profit]))).toEqual({ bruno: 3700, duarte: 1000, ana: 300, carla: -5000 });
    expect(periodRange("ano", NOW).from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(periodRange("90d", NOW).from?.toISOString()).toBe("2026-07-07T00:00:00.000Z");
    expect(periodRange("sempre", NOW)).toEqual({});
  });
});

describe("computeStats: prémios", () => {
  it("Noite de ouro e Noite de pesadelo", () => {
    expect(award("gold_night")!.main).toMatchObject({ player: { id: "bruno" }, value: { n: 5000 }, sessionId: "s7" });
    expect(award("nightmare")!.main).toMatchObject({ player: { id: "ana" }, value: { n: -4000 }, sessionId: "s4" });
  });

  it("Em chamas (com sequência ativa) e Em queda livre", () => {
    expect(award("on_fire")!.main).toMatchObject({ player: { id: "ana" }, value: { n: 3 }, sessionId: "s3" });
    expect(award("on_fire")!.extra).toMatchObject({ label: "Sequência ativa", player: { id: "bruno" }, value: { n: 2 }, sessionId: "s8" });
    expect(award("free_fall")!.main).toMatchObject({ player: { id: "carla" }, value: { n: 3 }, sessionId: "s8" });
  });

  it("Rei do rebuy: total e recorde numa noite (empate → o mais recente)", () => {
    expect(award("rebuy_king")!.main).toMatchObject({ player: { id: "bruno" }, value: { n: 5 } });
    // 2 rebuys numa noite: carla s2, bruno s3, ana s4, bruno s7 → mais recente = bruno s7
    expect(award("rebuy_king")!.extra).toMatchObject({ player: { id: "bruno" }, value: { n: 2 }, sessionId: "s7" });
  });

  it("Ressuscitado e Sem rede", () => {
    expect(award("comeback")!.main).toMatchObject({ player: { id: "bruno" }, value: { n: 5000 }, sessionId: "s7" });
    expect(award("no_net")!.main).toMatchObject({ player: { id: "ana" }, value: { n: 6 }, sessionId: "s8" });
  });

  it("Montanha-russa e Relógio suíço (só com ≥ MIN sessões)", () => {
    expect(award("rollercoaster")!.main.player!.id).toBe("bruno");
    expect(award("swiss_watch")!.main.player!.id).toBe("ana");
    expect(award("swiss_watch")!.main.value.n).toBe(Math.round(Math.sqrt(426) * 100)); // σ da ana = √426 €
  });

  it("Pilar da mesa (empate a 100 % → mesma recência → nome)", () => {
    expect(award("pillar")!.main).toMatchObject({ player: { id: "ana" }, value: { n: 1 } });
  });

  it("Fantasma: só ativos que falharam a última sessão, em dias", () => {
    expect(award("ghost")!.main).toMatchObject({ player: { id: "duarte" }, value: { kind: "days", n: 121 }, sessionId: "s6" });
    const noGhost = computeStats(DATA.map((s) => ({ ...s, players: s.players.map((p) => (p.playerId === "duarte" ? { ...p, active: false } : p)) })), { now: NOW });
    expect(noGhost.awards.find((a) => a.id === "ghost")).toBeUndefined();
  });

  it("Mesa de gala: maior pote e sessão com mais rebuys (empate → mais recente)", () => {
    expect(award("gala")!.main).toMatchObject({ player: null, value: { n: 14000 }, sessionId: "s2" });
    expect(award("gala")!.extra).toMatchObject({ value: { n: 3 }, sessionId: "s7" });
  });

  it("sem dados suficientes, os prémios não aparecem", () => {
    expect(computeStats([], { now: NOW }).awards).toEqual([]);
    const one = computeStats([DATA[0]], { now: NOW });
    const ids = one.awards.map((a) => a.id);
    expect(ids).not.toContain("on_fire"); // precisa de 2 vitórias seguidas
    expect(ids).not.toContain("rollercoaster"); // precisa de ≥ 3 sessões
    expect(ids).not.toContain("ghost");
    expect(ids).toContain("gold_night");
  });
});

describe("evolução e partilha", () => {
  it("saldo acumulado por sessão, por ordem de data; 5 linhas por defeito", () => {
    const ana = stats.evolution.find((e) => e.playerId === "ana")!;
    expect(ana.points).toEqual([3000, 4000, 4500, 500, 1700, 2500, 500, 2000]);
    const duarte = stats.evolution.find((e) => e.playerId === "duarte")!;
    expect(duarte.points).toEqual([0, 0, 0, 0, 0, 1000, 1000, 1000]);
    expect(stats.defaultLines).toEqual(["bruno", "ana", "carla", "duarte"]);
  });

  it("texto para WhatsApp com top 5 e um prémio", () => {
    const t = shareText(stats, "Sempre");
    expect(t).toContain("🥇 Bruno: +31,00 €");
    expect(t).toContain("Carla: −61,00 €");
    expect(t).toContain("🏆 Noite de ouro: Bruno (+50,00 €, 01/08/2026)");
  });
});
