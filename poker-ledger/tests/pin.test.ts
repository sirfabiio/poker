import { describe, expect, it } from "vitest";
import { afterFailure, AFTER_SUCCESS, hashPin, hashToken, lockRemainingMinutes, LOCK_MINUTES, MAX_PIN_ATTEMPTS, newSessionToken, validatePin, verifyPin } from "@/lib/pin";

describe("PIN", () => {
  it("nunca guarda o PIN em texto: hash scrypt com salt aleatório", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toContain("1234");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toBe(b); // salt diferente → hash diferente para o mesmo PIN
  });

  it("verifica o PIN certo e rejeita o errado", () => {
    const h = hashPin("246810");
    expect(verifyPin("246810", h)).toBe(true);
    expect(verifyPin("246811", h)).toBe(false);
    expect(verifyPin("246810", null)).toBe(false);
    expect(verifyPin("246810", "lixo")).toBe(false);
  });

  it("aceita só 4 a 8 algarismos", () => {
    expect(validatePin("1234")).toBeNull();
    expect(validatePin("12345678")).toBeNull();
    expect(validatePin("123")).not.toBeNull();
    expect(validatePin("123456789")).not.toBeNull();
    expect(validatePin("12a4")).not.toBeNull();
    expect(validatePin(undefined)).not.toBeNull();
  });
});

describe("limite de tentativas", () => {
  const now = new Date("2026-10-11T20:00:00Z");

  it(`bloqueia ${LOCK_MINUTES} min à ${MAX_PIN_ATTEMPTS}.ª falha seguida`, () => {
    let s = { ...AFTER_SUCCESS };
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      s = afterFailure(s, now);
      expect(s).toEqual({ failedPinAttempts: i, lockedUntil: null });
      expect(lockRemainingMinutes(s, now)).toBe(0);
    }
    s = afterFailure(s, now);
    expect(s.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
    expect(lockRemainingMinutes(s, now)).toBe(LOCK_MINUTES);
    expect(lockRemainingMinutes(s, new Date(now.getTime() + 14 * 60_000 + 1))).toBe(1);
    expect(lockRemainingMinutes(s, new Date(now.getTime() + LOCK_MINUTES * 60_000))).toBe(0);
  });

  it("um login certo repõe o contador", () => {
    expect(AFTER_SUCCESS).toEqual({ failedPinAttempts: 0, lockedUntil: null });
  });
});

describe("token de sessão", () => {
  it("o cookie leva um token aleatório; a base de dados só o hash", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
  });
});
