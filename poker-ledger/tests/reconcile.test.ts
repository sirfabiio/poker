import { describe, expect, it } from "vitest";
import { exceedsSoftLimit, reconcile, ReconcileError, type ReconcileMethod, type ReconcilePlayer } from "@/lib/reconcile";

const adj = (r: ReturnType<typeof reconcile>) => Object.fromEntries(r.adjustments.map((a) => [a.id, a.adjustment]));
const sum = (r: ReturnType<typeof reconcile>) => r.adjustments.reduce((s, a) => s + a.adjustment, 0);
const nets = (players: ReconcilePlayer[], r: ReturnType<typeof reconcile>) =>
  players.reduce((s, p, i) => s + (p.cashOut! - p.buyInTotal + r.adjustments[i].adjustment), 0);

describe("reconcile", () => {
  it("D = 0: ajustes todos 0 em qualquer método", () => {
    const players = [
      { id: "a", buyInTotal: 2000, cashOut: 3000 },
      { id: "b", buyInTotal: 2000, cashOut: 1000 },
    ];
    for (const method of ["EQUAL", "PROPORTIONAL"] as const) {
      const r = reconcile({ players, method });
      expect(r.discrepancy).toBe(0);
      expect(r.adjustments.every((a) => Object.is(a.adjustment, 0))).toBe(true);
    }
    expect(adj(reconcile({ players, method: "SINGLE_PLAYER", singlePlayerId: "a" }))).toEqual({ a: 0, b: 0 });
  });

  it("D positivo (sobra): ajustes negativos que somam −D", () => {
    const players = [
      { id: "a", buyInTotal: 2000, cashOut: 2200 },
      { id: "b", buyInTotal: 2000, cashOut: 2000 },
    ];
    const r = reconcile({ players, method: "EQUAL" });
    expect(r.discrepancy).toBe(200);
    expect(adj(r)).toEqual({ a: -100, b: -100 });
    expect(nets(players, r)).toBe(0);
  });

  it("D negativo (falta): ajustes positivos que somam −D", () => {
    const players = [
      { id: "a", buyInTotal: 2000, cashOut: 1700 },
      { id: "b", buyInTotal: 2000, cashOut: 2000 },
    ];
    const r = reconcile({ players, method: "EQUAL" });
    expect(r.discrepancy).toBe(-300);
    expect(adj(r)).toEqual({ a: 150, b: 150 });
    expect(nets(players, r)).toBe(0);
  });

  it("1 cêntimo de diferença vai para um só jogador (maior entrada)", () => {
    const players = [
      { id: "a", buyInTotal: 2000, cashOut: 2000 },
      { id: "b", buyInTotal: 4000, cashOut: 4001 },
      { id: "c", buyInTotal: 2000, cashOut: 2000 },
    ];
    const r = reconcile({ players, method: "EQUAL" });
    expect(adj(r)).toEqual({ a: 0, b: -1, c: 0 });
  });

  it("1,00 € por 3 jogadores: −34 / −33 / −33 (sobra) e +34 / +33 / +33 (falta)", () => {
    const over = [
      { id: "a", buyInTotal: 2000, cashOut: 2100 },
      { id: "b", buyInTotal: 2000, cashOut: 2000 },
      { id: "c", buyInTotal: 2000, cashOut: 2000 },
    ];
    expect(adj(reconcile({ players: over, method: "EQUAL" }))).toEqual({ a: -34, b: -33, c: -33 });
    const under = over.map((p) => ({ ...p, cashOut: p.id === "a" ? 1900 : p.cashOut }));
    expect(adj(reconcile({ players: under, method: "EQUAL" }))).toEqual({ a: 34, b: 33, c: 33 });
  });

  it("desempate do resto: maior buyInTotal, depois id", () => {
    const players = [
      { id: "z", buyInTotal: 2000, cashOut: 2000 },
      { id: "y", buyInTotal: 3000, cashOut: 3000 },
      { id: "x", buyInTotal: 2000, cashOut: 2002 },
    ];
    // −2 por 3: ninguém leva quota inteira; o 1.º cêntimo vai para y (maior entrada), o 2.º para x (id)
    expect(adj(reconcile({ players, method: "EQUAL" }))).toEqual({ x: -1, y: -1, z: 0 });
  });

  it("proporcional com resto", () => {
    const players = [
      { id: "a", buyInTotal: 1000, cashOut: 1000 },
      { id: "b", buyInTotal: 2000, cashOut: 2000 },
      { id: "c", buyInTotal: 4000, cashOut: 4010 },
    ];
    // −10 com pesos 1:2:4 → 1,43 / 2,86 / 5,71 → floors 1/2/5, sobram 2 → maiores restos b (0,86) e c (0,71)
    const r = reconcile({ players, method: "PROPORTIONAL" });
    expect(adj(r)).toEqual({ a: -1, b: -3, c: -6 });
    expect(sum(r)).toBe(-10);
  });

  it("SINGLE_PLAYER: o jogador indicado recebe −D inteiro", () => {
    const players = [
      { id: "a", buyInTotal: 2000, cashOut: 2000 },
      { id: "b", buyInTotal: 2000, cashOut: 1750 },
    ];
    expect(adj(reconcile({ players, method: "SINGLE_PLAYER", singlePlayerId: "a" }))).toEqual({ a: 250, b: 0 });
    expect(() => reconcile({ players, method: "SINGLE_PLAYER" })).toThrow(ReconcileError);
    expect(() => reconcile({ players, method: "SINGLE_PLAYER", singlePlayerId: "zz" })).toThrow(ReconcileError);
  });

  it("jogador com buyInTotal 0: fica fora do proporcional, entra no igual", () => {
    const players = [
      { id: "a", buyInTotal: 0, cashOut: 0 },
      { id: "b", buyInTotal: 2000, cashOut: 2100 },
      { id: "c", buyInTotal: 2000, cashOut: 2000 },
    ];
    expect(adj(reconcile({ players, method: "PROPORTIONAL" }))).toEqual({ a: 0, b: -50, c: -50 });
    expect(sum(reconcile({ players, method: "EQUAL" }))).toBe(-100);
    // ninguém com entradas: o proporcional divide por igual
    const zero = [
      { id: "a", buyInTotal: 0, cashOut: 1 },
      { id: "b", buyInTotal: 0, cashOut: 0 },
    ];
    expect(sum(reconcile({ players: zero, method: "PROPORTIONAL" }))).toBe(-1);
  });

  it("recusa cash-outs em falta e valores não inteiros", () => {
    expect(() => reconcile({ players: [{ id: "a", buyInTotal: 100, cashOut: null }], method: "EQUAL" })).toThrow(ReconcileError);
    expect(() => reconcile({ players: [{ id: "a", buyInTotal: 100, cashOut: 10.5 }], method: "EQUAL" })).toThrow(ReconcileError);
  });

  it("property: soma(ajustes) = −D e líquidos somam 0 (200 casos aleatórios)", () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    const methods: ReconcileMethod[] = ["EQUAL", "PROPORTIONAL", "SINGLE_PLAYER"];
    for (let k = 0; k < 200; k++) {
      const n = 1 + rnd(10);
      const players = Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        buyInTotal: rnd(4) === 0 ? 0 : rnd(50000),
        cashOut: rnd(60000),
      }));
      const method = methods[k % 3];
      const r = reconcile({ players, method, singlePlayerId: `p${rnd(n)}` });
      expect(sum(r)).toBe(-r.discrepancy);
      expect(nets(players, r)).toBe(0);
      for (const a of r.adjustments) {
        expect(Number.isSafeInteger(a.adjustment)).toBe(true);
        // nunca troca o sinal: todos os ajustes têm o sinal de −D (ou são 0)
        expect(a.adjustment * r.discrepancy).toBeLessThanOrEqual(0);
      }
    }
  });

  it("limites suaves: > 500 cêntimos OU > 5 % das entradas", () => {
    expect(exceedsSoftLimit(500, 100000)).toBe(false);
    expect(exceedsSoftLimit(-501, 100000)).toBe(true);
    expect(exceedsSoftLimit(300, 6000)).toBe(false); // exatamente 5 %
    expect(exceedsSoftLimit(301, 6000)).toBe(true);
  });
});
