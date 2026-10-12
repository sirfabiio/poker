// Chave mestra: a variável de ambiente ADMIN_PIN (só no servidor). Quem a tem pode repor o PIN de qualquer pessoa.
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** A chave configurada, ou null se faltar / for fraca (mínimo 6 algarismos, como o ADMIN_PIN de antes). */
export function configuredMasterKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const k = env.ADMIN_PIN ?? "";
  return /^\d{6,}$/.test(k) ? k : null;
}

/** Compara em tempo constante. */
export function masterKeyMatches(input: string, key: string): boolean {
  return timingSafeEqual(digest(input), digest(key));
}
