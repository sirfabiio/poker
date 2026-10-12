import { describe, expect, it } from "vitest";
import { canManageAccount } from "@/lib/admin";

describe("admin de grupo: quem pode mexer na conta de um jogador (nome, PIN)", () => {
  it("pode, se o jogador só está em grupos onde é admin", () => {
    expect(canManageAccount(["g2022"], ["g2022"])).toBe(true);
    expect(canManageAccount(["a", "b"], ["a", "b", "c"])).toBe(true);
  });
  it("não pode, se o jogador também está num grupo onde não é admin", () => {
    expect(canManageAccount(["gB", "g2022"], ["gB"])).toBe(false);
  });
  it("não pode mexer em quem não é de nenhum dos seus grupos", () => {
    expect(canManageAccount(["g2022"], ["gB"])).toBe(false);
    expect(canManageAccount([], ["gB"])).toBe(false);
  });
});
