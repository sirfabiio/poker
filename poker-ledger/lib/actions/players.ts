"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { clearViewerCookie, requirePlayer, setViewerCookie } from "../identity";
import { endAdminSession, requireAdmin, startAdminSession } from "../admin";
import { createPlayer, duplicateMessage, nameKey, validateName, type PlayerSummary } from "../players";
import { prismaPlayerStore } from "../players-db";
import { logActivity } from "../activity";
import { isAvatarColor } from "../colors";

export type AddPlayerResult = ActionResult<{ player: PlayerSummary }> & { existing?: PlayerSummary };

/** "Quem és tu?": escolher um perfil existente. Não escreve na base de dados. */
export async function chooseProfile(playerId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const p = await db.player.findUnique({ where: { id: String(playerId) }, select: { active: true } });
    if (!p?.active) throw new UserError("Este perfil não existe ou está desativado.");
    await setViewerCookie(String(playerId));
    return {};
  });
  if (r.ok) redirect("/");
  return r;
}

/** "Sou novo aqui": cria o próprio perfil e entra com ele (único pedido de escrita sem perfil). */
export async function createOwnProfile(name: string): Promise<AddPlayerResult> {
  let existing: PlayerSummary | undefined;
  const r = await run(async () => {
    const res = await db.$transaction(async (tx) => {
      const out = await createPlayer(prismaPlayerStore(tx), name, null);
      if (out.ok) {
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
      throw new UserError(res.error, res.code);
    }
    await setViewerCookie(res.player.id);
    return { player: res.player };
  });
  if (r.ok) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  return { ...r, existing };
}

/** "+ Adicionar pessoa nova": qualquer perfil pode criar um jogador. */
export async function addPlayer(name: string): Promise<AddPlayerResult> {
  let existing: PlayerSummary | undefined;
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const res = await db.$transaction(async (tx) => {
      const out = await createPlayer(prismaPlayerStore(tx), name, viewer.id);
      if (out.ok) {
        await logActivity(tx, {
          actorPlayerId: viewer.id,
          action: "player.create",
          entityType: "player",
          entityId: out.player.id,
          summary: `${viewer.name} adicionou ${out.player.name}`,
        });
      }
      return out;
    });
    if (!res.ok) {
      if (res.code === "duplicate") existing = res.existing;
      throw new UserError(res.error, res.code);
    }
    return { player: res.player };
  });
  if (r.ok) revalidatePath("/", "layout");
  return { ...r, existing };
}

async function assertNameFree(key: string, exceptId: string) {
  const other = await db.player.findUnique({ where: { nameKey: key }, select: { id: true, name: true } });
  if (other && other.id !== exceptId) throw new UserError(duplicateMessage(other), "duplicate");
}

/** Editar o próprio perfil: nome, cor e IBAN/MB WAY. */
export async function updateMyProfile(_: unknown, form: FormData): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const v = validateName(form.get("name"));
    if ("error" in v) throw new UserError(v.error);
    const color = form.get("avatarColor");
    if (!isAvatarColor(color)) throw new UserError("Escolhe uma cor válida.");
    const pay = String(form.get("ibanOrMbway") ?? "").trim().slice(0, 64) || null;
    await assertNameFree(v.key, viewer.id);
    await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: viewer.id },
        data: { name: v.name, nameKey: v.key, avatarColor: color, ibanOrMbway: pay },
      });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "player.update",
        entityType: "player",
        entityId: viewer.id,
        summary: `${v.name} atualizou o seu perfil`,
      });
    });
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function switchProfile() {
  await clearViewerCookie();
  await endAdminSession();
  redirect("/quem-es");
}

// ---------- Admin ----------

export async function adminLogin(_: unknown, form: FormData): Promise<ActionResult> {
  const r = await run(async () => {
    await requirePlayer();
    const ok = await startAdminSession(String(form.get("pin") ?? ""));
    if (!ok) {
      await new Promise((res) => setTimeout(res, 600)); // trava tentativas em série
      throw new UserError("PIN inválido.");
    }
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function adminLogout() {
  await endAdminSession();
  revalidatePath("/", "layout");
}

export async function renamePlayer(playerId: string, name: string): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await requireAdmin();
    const v = validateName(name);
    if ("error" in v) throw new UserError(v.error);
    const p = await db.player.findUnique({ where: { id: playerId }, select: { name: true } });
    if (!p) throw new UserError("Jogador não encontrado.");
    await assertNameFree(nameKey(v.name), playerId);
    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: playerId }, data: { name: v.name, nameKey: v.key } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "player.rename",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) mudou o nome de ${p.name} para ${v.name}`,
      });
    });
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/** Desativa ou reativa. Nunca se apagam jogadores. */
export async function setPlayerActive(playerId: string, active: boolean): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    await requireAdmin();
    if (playerId === viewer.id && !active) throw new UserError("Não te podes desativar a ti próprio.");
    const p = await db.player.findUnique({ where: { id: playerId }, select: { name: true } });
    if (!p) throw new UserError("Jogador não encontrado.");
    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: playerId }, data: { active: Boolean(active) } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: active ? "player.activate" : "player.deactivate",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) ${active ? "reativou" : "desativou"} ${p.name}`,
      });
    });
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/** Versão para <form action>: escolher perfil sem JavaScript. */
export async function chooseProfileForm(playerId: string): Promise<void> {
  await chooseProfile(playerId);
}
