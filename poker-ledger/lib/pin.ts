// PIN pessoal: hash scrypt com salt aleatório (node:crypto, sem dependências) e regra de bloqueio.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

import { PIN_MAX, PIN_MIN } from "./pin-rules";
export { PIN_MAX, PIN_MIN };
/** Falhas seguidas antes de bloquear. */
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

const N = 16384; // custo do scrypt (2^14)
const R = 8;
const P = 1;
const KEYLEN = 32;

export function validatePin(pin: unknown): string | null {
  if (typeof pin !== "string" || !new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) {
    return `O PIN tem de ter entre ${PIN_MIN} e ${PIN_MAX} algarismos.`;
  }
  return null;
}

/** "scrypt$N$r$p$<salt>$<hash>" (base64url). O salt é aleatório: o mesmo PIN dá hashes diferentes. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(pin, Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type LockState = { failedPinAttempts: number; lockedUntil: Date | null };

/** Minutos que faltam de bloqueio (0 = não bloqueado). */
export function lockRemainingMinutes(s: LockState, now = new Date()): number {
  if (!s.lockedUntil || s.lockedUntil <= now) return 0;
  return Math.ceil((s.lockedUntil.getTime() - now.getTime()) / 60_000);
}

/** Estado depois de uma falha: à 5.ª falha seguida bloqueia 15 min e o contador recomeça. */
export function afterFailure(s: LockState, now = new Date()): LockState {
  const failed = s.failedPinAttempts + 1;
  if (failed >= MAX_PIN_ATTEMPTS) {
    return { failedPinAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { failedPinAttempts: failed, lockedUntil: null };
}

export const AFTER_SUCCESS: LockState = { failedPinAttempts: 0, lockedUntil: null };

/** Token de sessão: aleatório no cookie, só o SHA-256 na base de dados. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
