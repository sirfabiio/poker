import { describe, expect, it } from "vitest";
import { reconcile } from "@/lib/reconcile";
import { checkSession, playerNet, summarizeOpen } from "@/lib/ledger";
import { computeTransfers } from "@/lib/settle";

describe("integração: diferença de contagem → ajuste → fecho", () => {
  it("D = +300 com 3 jogadores: −100 cada, líquidos somam 0 e o fecho bate certo", () => {
    const rows = [
      { playerId: "ana", cashOut: 5100, buyIns: [2000, 2000] },
      { playerId: "rui", cashOut: 2200, buyIns: [2000] },
      { playerId: "tiago", cashOut: 1000, buyIns: [2000] },
    ];
    const before = checkSession(rows);
    expect(before.diff).toBe(300);
    expect(before.valid).toBe(false);

    // Uma sessão com D ≠ 0 e sem ajuste bloqueia o fecho e diz porquê
    const blocked = summarizeOpen([{ id: "s1", date: new Date(), players: rows }]);
    expect(blocked.invalid).toHaveLength(1);
    expect(blocked.invalid[0].check.diff).toBe(300);

    const r = reconcile({
      players: rows.map((p) => ({ id: p.playerId, buyInTotal: p.buyIns.reduce((s, a) => s + a, 0), cashOut: p.cashOut })),
      method: "EQUAL",
    });
    expect(r.adjustments.map((a) => a.adjustment)).toEqual([-100, -100, -100]);

    const adjusted = rows.map((p, i) => ({ ...p, adjustment: r.adjustments[i].adjustment }));
    expect(adjusted.reduce((s, p) => s + playerNet(p), 0)).toBe(0);
    expect(checkSession(adjusted, true).valid).toBe(true);

    const open = summarizeOpen([{ id: "s1", date: new Date(), reconciled: true, players: adjusted }]);
    expect(open.invalid).toHaveLength(0);
    expect(Object.fromEntries(open.balances)).toEqual({ ana: 1000, rui: 100, tiago: -1100 });

    const transfers = computeTransfers([...open.balances].map(([playerId, amount]) => ({ playerId, amount })));
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(1100);
    expect(transfers).toEqual([
      { fromPlayerId: "tiago", toPlayerId: "ana", amount: 1000 },
      { fromPlayerId: "tiago", toPlayerId: "rui", amount: 100 },
    ]);
  });

  it("ajuste anulado (adjustment = 0, sem reconciliação) volta a bloquear", () => {
    const rows = [
      { playerId: "a", cashOut: 2300, buyIns: [2000], adjustment: 0 },
      { playerId: "b", cashOut: 2000, buyIns: [2000], adjustment: 0 },
    ];
    expect(checkSession(rows, false).valid).toBe(false);
    // ajuste "marcado" mas com valores que já não batem certo também não conta
    expect(checkSession([{ ...rows[0], adjustment: -100 }, rows[1]], true).valid).toBe(false);
  });
});
