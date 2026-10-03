// ÚNICO módulo com a verificação de admin.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { UserError } from "./errors";

const COOKIE = "pl_admin";
export const ADMIN_TTL_SECONDS = 12 * 60 * 60;

function configuredPin(env: NodeJS.ProcessEnv = process.env): string {
  const pin = env.ADMIN_PIN ?? "";
  if (!/^\d{6,}$/.test(pin)) {
    throw new UserError("O ADMIN_PIN não está configurado no servidor (precisa de pelo menos 6 dígitos).");
  }
  return pin;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Compara o PIN em tempo constante. */
export function pinMatches(input: string, pin: string): boolean {
  return timingSafeEqual(digest(input), digest(pin));
}

function sign(exp: number, pin: string) {
  return createHmac("sha256", `poker-ledger-admin:${pin}`).update(String(exp)).digest("base64url");
}

/** Token "expiração.assinatura" (HMAC com o PIN). Mudar o PIN invalida todas as sessões. */
export function makeAdminToken(pin: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + ADMIN_TTL_SECONDS;
  return `${exp}.${sign(exp, pin)}`;
}

export function verifyAdminToken(token: string | undefined, pin: string, nowMs = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isSafeInteger(exp) || !sig || exp * 1000 <= nowMs) return false;
  const expected = Buffer.from(sign(exp, pin));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function isAdmin(): Promise<boolean> {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return false;
  return verifyAdminToken((await cookies()).get(COOKIE)?.value, pin);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new UserError("Esta ação é só para o admin. Entra com o PIN.", "not_admin");
}

/** Valida o PIN e abre a sessão de admin (cookie httpOnly, 12h). */
export async function startAdminSession(input: string): Promise<boolean> {
  const pin = configuredPin();
  if (!pinMatches(input, pin)) return false;
  (await cookies()).set(COOKIE, makeAdminToken(pin), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_TTL_SECONDS,
    path: "/",
  });
  return true;
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}
