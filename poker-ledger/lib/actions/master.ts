"use server";

import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { validateName } from "../players";
import { logActivity } from "../activity";
import { configuredMasterKey, masterKeyMatches } from "../master-key";
import { AFTER_SUCCESS, afterFailure, hashPin, lockRemainingMinutes, MAX_PIN_ATTEMPTS, validatePin } from "../pin";

export type MasterResetResult = ActionResult<{ name: string }> & { lastName?: string };

/**
 * Repor o PIN de uma pessoa com a chave mestra (ADMIN_PIN). Não precisa de sessão iniciada.
 * As tentativas erradas contam para o bloqueio do perfil dessa pessoa (5 falhas → 15 min), por isso a chave
 * não se adivinha por tentativa e erro. Termina as sessões abertas da pessoa.
 */
export async function masterResetPin(_: unknown, form: FormData): Promise<MasterResetResult> {
  const r = await run(async () => {
    const key = configuredMasterKey();
    if (!key) throw new UserError("A chave mestra não está configurada no servidor (variável ADMIN_PIN, pelo menos 6 algarismos).", "not_configured");
    const v = validateName(form.get("name"));
    if ("error" in v) throw new UserError(v.error);
    const pin = String(form.get("pin") ?? "");
    const pinError = validatePin(pin);
    if (pinError) throw new UserError(pinError);
    if (String(form.get("pinConfirm") ?? "") !== pin) throw new UserError("Os dois PINs novos não são iguais.");
    const input = String(form.get("masterKey") ?? "");

    const out = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; name: string; failedPinAttempts: number; lockedUntil: Date | null }[]>`
        SELECT "id", "name", "failedPinAttempts", "lockedUntil" FROM "Player" WHERE "nameKey" = ${v.key} FOR UPDATE`;
      const p = rows[0];
      if (!p) throw new UserError("Não há ninguém com esse nome.");
      const locked = lockRemainingMinutes(p);
      if (locked > 0) throw new UserError(`Demasiadas tentativas falhadas para ${p.name}. Tenta outra vez daqui a ${locked} min.`, "locked");
      if (!masterKeyMatches(input, key)) {
        const next = afterFailure(p);
        await tx.player.update({ where: { id: p.id }, data: next });
        return { failed: next, name: "" };
      }
      await tx.player.update({ where: { id: p.id }, data: { pinHash: hashPin(pin), ...AFTER_SUCCESS } });
      await tx.authSession.deleteMany({ where: { playerId: p.id } });
      await logActivity(tx, {
        actorPlayerId: p.id,
        action: "player.masterResetPin",
        entityType: "player",
        entityId: p.id,
        summary: `O PIN de ${p.name} foi reposto com a chave mestra`,
      });
      return { failed: null, name: p.name };
    });

    if (out.failed) {
      // A falha fica gravada (commit); o atraso torna as tentativas lentas.
      await new Promise((res) => setTimeout(res, 1000));
      const failed = out.failed;
      if (failed.lockedUntil) throw new UserError(`Demasiadas tentativas falhadas. Tenta outra vez daqui a ${lockRemainingMinutes(failed)} min.`, "locked");
      const left = MAX_PIN_ATTEMPTS - failed.failedPinAttempts;
      throw new UserError(`Chave mestra errada. ${left === 1 ? "Resta 1 tentativa" : `Restam ${left} tentativas`} antes de bloquear este perfil.`, "bad_key");
    }
    return { name: out.name };
  });
  // Devolve o nome para o formulário o manter (a chave e os PINs não voltam ao browser).
  return { ...r, lastName: String(form.get("name") ?? "").slice(0, 30) };
}
