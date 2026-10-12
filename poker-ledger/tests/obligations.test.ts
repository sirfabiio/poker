import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/queries", () => ({ getOpenState: vi.fn() }));

const { describeObligations, hasObligations } = await import("@/lib/obligations");

const none = { owes: [], owed: [], pendingSessions: [] };

describe("contas por saldar num grupo", () => {
  it("sem nada pendente não bloqueia", () => {
    expect(hasObligations(none)).toBe(false);
    expect(describeObligations(none, "eu")).toEqual([]);
  });

  it("quem deve: mostra o valor e a quem", () => {
    const o = { ...none, owes: [{ otherName: "Rui", amount: 1250, where: "fecho “Janeiro”" }] };
    expect(hasObligations(o)).toBe(true);
    expect(describeObligations(o, "eu")[0]).toMatch(/^Deves 12,50\s€ a Rui \(fecho “Janeiro”\)\.$/);
    expect(describeObligations(o, "Ana")[0]).toMatch(/^Ana deve 12,50\s€ a Rui/);
  });

  it("quem tem a receber também bloqueia", () => {
    const o = { ...none, owed: [{ otherName: "Ana", amount: 500, where: "sessões ainda não fechadas" }] };
    expect(hasObligations(o)).toBe(true);
    expect(describeObligations(o, "eu")[0]).toMatch(/^Ana deve-te 5,00\s€/);
    expect(describeObligations(o, "Rui")[0]).toMatch(/^Ana deve a Rui 5,00\s€/);
  });

  it("sessão em aberto por acertar bloqueia (o resultado ainda pode mudar)", () => {
    const o = { ...none, pendingSessions: ["sexta, 9/10"] };
    expect(hasObligations(o)).toBe(true);
    expect(describeObligations(o, "eu")[0]).toContain("Estás na sessão de sexta, 9/10");
  });
});
