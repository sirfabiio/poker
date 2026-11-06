import { describe, expect, it } from "vitest";
import { canEditSessionMoney } from "../lib/session-permissions";

describe("canEditSessionMoney", () => {
  it("admin do grupo pode sempre", () => {
    expect(canEditSessionMoney({ role: "ADMIN", viewerId: "a", createdByPlayerId: "b" })).toBe(true);
  });
  it("quem criou a sessão pode", () => {
    expect(canEditSessionMoney({ role: "MEMBER", viewerId: "b", createdByPlayerId: "b" })).toBe(true);
  });
  it("outro membro não pode", () => {
    expect(canEditSessionMoney({ role: "MEMBER", viewerId: "a", createdByPlayerId: "b" })).toBe(false);
  });
});
