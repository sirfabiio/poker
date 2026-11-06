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

import { canEditSession, canSealSession, canUnsealSession } from "../lib/session-permissions";

describe("lacre", () => {
  it("sessão lacrada: quem a criou já não altera rebuys/cash-outs", () => {
    expect(canEditSessionMoney({ role: "MEMBER", viewerId: "b", createdByPlayerId: "b", sealed: true })).toBe(false);
    expect(canEditSessionMoney({ role: "ADMIN", viewerId: "a", createdByPlayerId: "b", sealed: true })).toBe(true);
  });
  it("sessão lacrada: só o admin edita jogadores/dados", () => {
    expect(canEditSession({ role: "MEMBER", sealed: true })).toBe(false);
    expect(canEditSession({ role: "ADMIN", sealed: true })).toBe(true);
    expect(canEditSession({ role: "MEMBER", sealed: false })).toBe(true);
  });
  it("lacrar: admin ou quem criou; tirar o lacre: só admin", () => {
    expect(canSealSession({ role: "MEMBER", viewerId: "b", createdByPlayerId: "b" })).toBe(true);
    expect(canSealSession({ role: "MEMBER", viewerId: "a", createdByPlayerId: "b" })).toBe(false);
    expect(canUnsealSession({ role: "MEMBER" })).toBe(false);
    expect(canUnsealSession({ role: "ADMIN" })).toBe(true);
  });
});
