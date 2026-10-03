import { describe, expect, it } from "vitest";
import { computeTransfers, SettlementError, type Balance, type PlannedTransfer } from "@/lib/settle";

/** Aplica as transferências e devolve o saldo final de cada jogador (deve ser tudo 0). */
function applyAll(balances: Balance[], transfers: PlannedTransfer[]) {
  const left = new Map(balances.map((b) => [b.playerId, b.amount]));
  for (const t of transfers) {
    left.set(t.fromPlayerId, left.get(t.fromPlayerId)! + t.amount);
    left.set(t.toPlayerId, left.get(t.toPlayerId)! - t.amount);
  }
  return left;
}

function expectSettled(balances: Balance[], transfers: PlannedTransfer[]) {
  for (const t of transfers) {
    expect(Number.isInteger(t.amount)).toBe(true);
    expect(t.amount).toBeGreaterThan(0);
    expect(t.fromPlayerId).not.toBe(t.toPlayerId);
  }
  for (const v of applyAll(balances, transfers).values()) expect(v).toBe(0);
}

describe("computeTransfers", () => {
  it("ciclo sem sessões: sem saldos, sem transferências", () => {
    expect(computeTransfers([])).toEqual([]);
  });

  it("saldos que somam zero entre dois jogadores", () => {
    const b = [
      { playerId: "ana", amount: 2500 },
      { playerId: "rui", amount: -2500 },
    ];
    expect(computeTransfers(b)).toEqual([{ fromPlayerId: "rui", toPlayerId: "ana", amount: 2500 }]);
  });

  it("vários devedores e credores: maior devedor paga ao maior credor", () => {
    const b = [
      { playerId: "a", amount: 7000 },
      { playerId: "b", amount: 3000 },
      { playerId: "c", amount: -6000 },
      { playerId: "d", amount: -2500 },
      { playerId: "e", amount: -1500 },
    ];
    const t = computeTransfers(b);
    expect(t[0]).toEqual({ fromPlayerId: "c", toPlayerId: "a", amount: 6000 });
    expectSettled(b, t);
    // nunca mais do que n − 1 transferências
    expect(t.length).toBeLessThanOrEqual(b.length - 1);
  });

  it("jogador com saldo zero não entra em nenhuma transferência", () => {
    const b = [
      { playerId: "a", amount: 1000 },
      { playerId: "zero", amount: 0 },
      { playerId: "b", amount: -1000 },
    ];
    const t = computeTransfers(b);
    expect(t.some((x) => x.fromPlayerId === "zero" || x.toPlayerId === "zero")).toBe(false);
    expectSettled(b, t);
  });

  it("todos a zero: nenhuma transferência", () => {
    expect(computeTransfers([{ playerId: "a", amount: 0 }, { playerId: "b", amount: 0 }])).toEqual([]);
  });

  it("arredondamento: cêntimos ímpares não se perdem nem se criam", () => {
    const b = [
      { playerId: "a", amount: 1001 },
      { playerId: "b", amount: 333 },
      { playerId: "c", amount: -667 },
      { playerId: "d", amount: -334 },
      { playerId: "e", amount: -333 },
    ];
    const t = computeTransfers(b);
    expectSettled(b, t);
    const paid = t.reduce((s, x) => s + x.amount, 0);
    expect(paid).toBe(1001 + 333);
  });

  it("aborta se a soma dos saldos não for exatamente 0", () => {
    expect(() =>
      computeTransfers([
        { playerId: "a", amount: 1000 },
        { playerId: "b", amount: -999 },
      ]),
    ).toThrow(SettlementError);
  });

  it("rejeita valores que não são inteiros em cêntimos", () => {
    expect(() =>
      computeTransfers([
        { playerId: "a", amount: 10.5 },
        { playerId: "b", amount: -10.5 },
      ]),
    ).toThrow(SettlementError);
  });

  it("é determinístico e não altera a entrada", () => {
    const b = [
      { playerId: "x", amount: 500 },
      { playerId: "y", amount: 500 },
      { playerId: "z", amount: -1000 },
    ];
    const copy = structuredClone(b);
    expect(computeTransfers(b)).toEqual(computeTransfers(b));
    expect(b).toEqual(copy);
  });

  it("muitos jogadores aleatórios ficam sempre saldados", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed);
    for (let round = 0; round < 50; round++) {
      const n = 2 + (rnd() % 12);
      const b: Balance[] = [];
      let sum = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = (rnd() % 20001) - 10000;
        b.push({ playerId: `p${i}`, amount: v });
        sum += v;
      }
      b.push({ playerId: `p${n - 1}`, amount: -sum });
      const t = computeTransfers(b);
      expectSettled(b, t);
      expect(t.length).toBeLessThanOrEqual(n - 1);
    }
  });
});
