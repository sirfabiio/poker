import { describe, expect, it } from "vitest";
import { checkSession, playerNet, summarizeOpen } from "@/lib/ledger";

const d = new Date("2026-10-01T00:00:00Z");

describe("ledger", () => {
  it("resultado líquido = cashOut − soma dos buy-ins", () => {
    expect(playerNet({ playerId: "a", cashOut: 5500, buyIns: [2000, 2000] })).toBe(1500);
  });

  it("sessão válida só com todos os cash-outs e soma certa", () => {
    expect(
      checkSession([
        { playerId: "a", cashOut: 3000, buyIns: [2000] },
        { playerId: "b", cashOut: 1000, buyIns: [2000] },
      ]).valid,
    ).toBe(true);
    const missing = checkSession([
      { playerId: "a", cashOut: null, buyIns: [2000] },
      { playerId: "b", cashOut: 1000, buyIns: [2000] },
    ]);
    expect(missing.valid).toBe(false);
    expect(missing.missingCashOuts).toBe(1);
    const wrong = checkSession([
      { playerId: "a", cashOut: 3500, buyIns: [2000] },
      { playerId: "b", cashOut: 1000, buyIns: [2000] },
    ]);
    expect(wrong.valid).toBe(false);
    expect(wrong.diff).toBe(500);
  });

  it("agrega só sessões válidas e soma zero", () => {
    const s = summarizeOpen([
      { id: "s1", date: d, players: [
        { playerId: "a", cashOut: 3000, buyIns: [2000] },
        { playerId: "b", cashOut: 1000, buyIns: [2000] },
      ] },
      { id: "s2", date: d, players: [
        { playerId: "a", cashOut: 0, buyIns: [2000, 2000] },
        { playerId: "c", cashOut: 6000, buyIns: [2000] },
      ] },
      { id: "s3", date: d, players: [{ playerId: "a", cashOut: null, buyIns: [2000] }] },
    ]);
    expect(s.validIds).toEqual(["s1", "s2"]);
    expect(s.invalid.map((x) => x.id)).toEqual(["s3"]);
    expect(Object.fromEntries(s.balances)).toEqual({ a: -3000, b: -1000, c: 4000 });
    expect([...s.balances.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });
});
