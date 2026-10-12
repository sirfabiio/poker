"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { endSession, startSession } from "../identity";
import { clearGroupCookie } from "../group";
import { createPlayer, validateName, type PlayerSummary } from "../players";
import { prismaPlayerStore } from "../players-db";
import { logActivity } from "../activity";
import { AFTER_SUCCESS, afterFailure, hashPin, lockRemainingMinutes, MAX_PIN_ATTEMPTS, PIN_MAX, PIN_MIN, validatePin, verifyPin } from "../pin";

export type LoginResult = ActionResult & { needsConfirm?: boolean; name?: string };

const lockedMessage = (min: number) => `Demasiadas tentativas falhadas. Tenta outra vez daqui a ${min} min.`;

/**
 * Entrar com nome + PIN. Se a pessoa ainda não tem PIN (dados antigos), é o primeiro acesso:
 * pede a confirmação e define-o (o primeiro a definir fica com o perfil).
 */
export async function login(_: unknown, form: FormData): Promise<LoginResult> {
  let needsConfirm = false;
  const r = await run(async () => {
    const name = String(form.get("name") ?? "");
    const pin = String(form.get("pin") ?? "");
    const confirm = form.get("pinConfirm");
    const v = validateName(name);
    if ("error" in v) throw new UserError(v.error);
    // PIN vazio é aceite só para descobrir o primeiro acesso (quem ainda não tem PIN escolhe-o a seguir).
    const pinError = pin === "" ? null : validatePin(pin);
    if (pinError) throw new UserError(pinError);

    const playerId = await db.$transaction(async (tx) => {
      // Bloqueia a linha do jogador: tentativas em paralelo não escapam ao contador.
      const rows = await tx.$queryRaw<
        { id: string; name: string; active: boolean; pinHash: string | null; failedPinAttempts: number; lockedUntil: Date | null }[]
      >`SELECT "id", "name", "active", "pinHash", "failedPinAttempts", "lockedUntil" FROM "Player" WHERE "nameKey" = ${v.key} FOR UPDATE`;
      const p = rows[0];
      if (!p) throw new UserError("Não há ninguém com esse nome. Se és novo, usa “Sou novo aqui”.");
      if (!p.active) throw new UserError("Este perfil está desativado. Fala com o admin do teu grupo.");
      const locked = lockRemainingMinutes(p);
      if (locked > 0) throw new UserError(lockedMessage(locked), "locked");

      if (!p.pinHash) {
        // Primeiro acesso (opção B): a pessoa escolhe o PIN agora.
        if (pin === "") {
          needsConfirm = true;
          throw new UserError(`Primeiro acesso de ${p.name}: escolhe o teu PIN (${PIN_MIN} a ${PIN_MAX} algarismos) e confirma-o.`, "set_pin");
        }
        if (confirm === null) {
          needsConfirm = true;
          throw new UserError(`Primeiro acesso de ${p.name}: confirma o PIN que queres usar a partir de agora.`, "set_pin");
        }
        if (String(confirm) !== pin) {
          needsConfirm = true;
          throw new UserError("Os dois PINs não são iguais.", "set_pin");
        }
        await tx.player.update({ where: { id: p.id }, data: { pinHash: hashPin(pin), ...AFTER_SUCCESS } });
        await logActivity(tx, {
          actorPlayerId: p.id,
          action: "player.setPin",
          entityType: "player",
          entityId: p.id,
          summary: `${p.name} definiu o seu PIN (primeiro acesso)`,
        });
        return p.id;
      }

      if (pin === "") throw new UserError("Escreve o teu PIN.", "no_pin");
      if (!verifyPin(pin, p.pinHash)) {
        const next = afterFailure(p);
        await tx.player.update({ where: { id: p.id }, data: next });
        return { failed: next };
      }
      await tx.player.update({ where: { id: p.id }, data: AFTER_SUCCESS });
      return p.id;
    });

    if (typeof playerId !== "string") {
      // A falha fica gravada (a transação fez commit); só depois se responde com erro.
      await new Promise((res) => setTimeout(res, 400));
      const { failed } = playerId;
      if (failed.lockedUntil) throw new UserError(lockedMessage(lockRemainingMinutes(failed)), "locked");
      const left = MAX_PIN_ATTEMPTS - failed.failedPinAttempts;
      throw new UserError(`PIN errado. ${left === 1 ? "Resta 1 tentativa" : `Restam ${left} tentativas`} antes de bloquear.`, "bad_pin");
    }
    await startSession(playerId);
    return {};
  });
  if (r.ok) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  // Devolve o nome para o formulário o manter preenchido (os PINs não voltam ao browser).
  return { ...r, needsConfirm, name: String(form.get("name") ?? "").slice(0, 30) };
}

export type SignUpResult = ActionResult & { existing?: PlayerSummary };

/** "Sou novo aqui": cria o perfil com nome + PIN e entra (único pedido de escrita sem sessão). */
export async function signUp(_: unknown, form: FormData): Promise<SignUpResult> {
  let existing: PlayerSummary | undefined;
  const r = await run(async () => {
    const pin = String(form.get("pin") ?? "");
    const pinError = validatePin(pin);
    if (pinError) throw new UserError(pinError);
    if (String(form.get("pinConfirm") ?? "") !== pin) throw new UserError("Os dois PINs não são iguais.");
    const pinHash = hashPin(pin);
    const res = await db.$transaction(async (tx) => {
      const out = await createPlayer(prismaPlayerStore(tx), form.get("name"), null);
      if (out.ok) {
        await tx.player.update({ where: { id: out.player.id }, data: { pinHash } });
        await logActivity(tx, {
          actorPlayerId: out.player.id,
          action: "player.create",
          entityType: "player",
          entityId: out.player.id,
          summary: `${out.player.name} criou o seu perfil`,
        });
      }
      return out;
    });
    if (!res.ok) {
      if (res.code === "duplicate") existing = res.existing;
      throw new UserError(
        res.code === "duplicate" ? `${res.error}. Se és tu, entra com o teu nome e PIN.` : res.error,
        res.code,
      );
    }
    await startSession(res.player.id);
    return {};
  });
  if (r.ok) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  return { ...r, existing };
}

/** Terminar sessão neste dispositivo. */
export async function logout() {
  await endSession();
  await clearGroupCookie();
  redirect("/quem-es");
}
