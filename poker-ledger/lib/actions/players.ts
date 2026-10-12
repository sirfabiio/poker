"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { STATS_TAG } from "../config";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { requirePlayer } from "../identity";
import { requireGroupMember } from "../group";
import { canManageAccount, requireAdmin } from "../admin";
import { createPlayer, duplicateMessage, nameKey, validateName, type PlayerSummary } from "../players";
import { prismaPlayerStore } from "../players-db";
import { logActivity } from "../activity";
import { describeObligations, hasObligations, memberObligations } from "../obligations";
import { isAvatarColor } from "../colors";
import { AFTER_SUCCESS, hashPin, hashToken, validatePin, verifyPin } from "../pin";

export type AddPlayerResult = ActionResult<{ player: PlayerSummary }> & { existing?: PlayerSummary };

const refresh = () => {
  revalidateTag(STATS_TAG); // nomes, cores e estado aparecem no ranking
  revalidatePath("/", "layout");
};

/**
 * "+ Adicionar pessoa nova" (qualquer membro): cria o jogador e torna-o membro do grupo ativo.
 * Se o nome já existir: sendo membro ativo deste grupo, oferece-o; senão (outro grupo ou removido daqui), junta-o.
 */
export async function addPlayer(name: string): Promise<AddPlayerResult> {
  let existing: PlayerSummary | undefined;
  const r = await run(async () => {
    const { viewer, groupId } = await requireGroupMember();
    const res = await db.$transaction(async (tx) => {
      const out = await createPlayer(prismaPlayerStore(tx), name, viewer.id);
      if (out.ok) {
        await tx.membership.create({ data: { groupId, playerId: out.player.id } });
        await logActivity(tx, {
          actorPlayerId: viewer.id,
          groupId,
          action: "player.create",
          entityType: "player",
          entityId: out.player.id,
          summary: `${viewer.name} adicionou ${out.player.name}`,
        });
      } else if (out.code === "duplicate") {
        const m = await tx.membership.findUnique({
          where: { groupId_playerId: { groupId, playerId: out.existing.id } },
          select: { active: true },
        });
        // Já é membro ativo deste grupo: oferece-o em vez de criar outro.
        if (m?.active) return { ...out, existing: { ...out.existing, active: true } };
        const p = await tx.player.findUnique({ where: { id: out.existing.id }, select: { active: true } });
        if (!p?.active) return { ok: false as const, code: "inactive", error: "Esse perfil está desativado." };
        // Pessoa de outro grupo (ou removida deste): qualquer membro a pode juntar.
        if (m) await tx.membership.update({ where: { groupId_playerId: { groupId, playerId: out.existing.id } }, data: { active: true } });
        else await tx.membership.create({ data: { groupId, playerId: out.existing.id } });
        await logActivity(tx, {
          actorPlayerId: viewer.id,
          groupId,
          action: "group.addMember",
          entityType: "player",
          entityId: out.existing.id,
          summary: `${viewer.name} juntou ${out.existing.name} ao grupo`,
        });
        return { ok: true as const, player: { ...out.existing, active: true } };
      }
      return out;
    });
    if (!res.ok) {
      if (res.code === "duplicate" && "existing" in res) existing = res.existing;
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

/** Editar o próprio perfil: nome, cor e IBAN/MB WAY (é da pessoa, vale em todos os seus grupos). */
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
  if (r.ok) refresh();
  return r;
}

/** Trocar o meu PIN: pede o atual. Termina as outras sessões (os outros dispositivos voltam a pedir PIN). */
export async function changeMyPin(_: unknown, form: FormData): Promise<ActionResult> {
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const current = String(form.get("currentPin") ?? "");
    const next = String(form.get("newPin") ?? "");
    const err = validatePin(next);
    if (err) throw new UserError(err);
    if (String(form.get("newPinConfirm") ?? "") !== next) throw new UserError("Os dois PINs novos não são iguais.");
    const p = await db.player.findUnique({ where: { id: viewer.id }, select: { pinHash: true } });
    if (!verifyPin(current, p?.pinHash ?? null)) {
      await new Promise((res) => setTimeout(res, 400));
      throw new UserError("O PIN atual não está certo.");
    }
    const token = (await cookies()).get("pl_session")?.value ?? "";
    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: viewer.id }, data: { pinHash: hashPin(next), ...AFTER_SUCCESS } });
      await tx.authSession.deleteMany({ where: { playerId: viewer.id, NOT: { tokenHash: hashToken(token) } } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        action: "player.changePin",
        entityType: "player",
        entityId: viewer.id,
        summary: `${viewer.name} trocou o seu PIN`,
      });
    });
    return {};
  });
  return r;
}

// ---------- Admin do grupo (só dentro do grupo ativo) ----------

/** Pertença do jogador ao grupo do admin + grupos onde o jogador está + grupos onde o pedido é admin. */
async function memberForAdmin(tx: Prisma.TransactionClient, groupId: string, adminId: string, playerId: string) {
  const target = await tx.player.findFirst({
    where: { id: playerId, memberships: { some: { groupId } } },
    select: { name: true, memberships: { select: { groupId: true } } },
  });
  if (!target) throw new UserError("Este jogador não é membro do teu grupo.");
  const adminOf = await tx.membership.findMany({ where: { playerId: adminId, role: "ADMIN", active: true }, select: { groupId: true } });
  return {
    name: target.name,
    canManage: canManageAccount(
      target.memberships.map((m) => m.groupId),
      adminOf.map((m) => m.groupId),
    ),
  };
}

const OTHER_GROUP =
  "Esta pessoa também está noutro grupo onde não és admin: só ela pode mudar o nome ou o PIN no seu perfil.";

export async function renamePlayer(playerId: string, name: string): Promise<ActionResult> {
  const r = await run(async () => {
    const { viewer, groupId } = await requireAdmin();
    const v = validateName(name);
    if ("error" in v) throw new UserError(v.error);
    await assertNameFree(nameKey(v.name), playerId);
    await db.$transaction(async (tx) => {
      const t = await memberForAdmin(tx, groupId, viewer.id, playerId);
      if (!t.canManage) throw new UserError(OTHER_GROUP, "forbidden");
      await tx.player.update({ where: { id: playerId }, data: { name: v.name, nameKey: v.key } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId,
        action: "player.rename",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) mudou o nome de ${t.name} para ${v.name}`,
      });
    });
    return {};
  });
  if (r.ok) refresh();
  return r;
}

/**
 * Remover um membro do grupo (só admin, nunca a si próprio): a pertença fica inativa, a pessoa deixa de ver o grupo
 * e o histórico mantém-se. Bloqueado se a pessoa ainda deve ou tem a receber neste grupo.
 */
export async function removeMember(playerId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const { viewer, groupId } = await requireAdmin();
    if (playerId === viewer.id) {
      throw new UserError("Não te podes remover a ti próprio. Para saíres, passa primeiro o admin a outra pessoa.");
    }
    const m = await db.membership.findUnique({
      where: { groupId_playerId: { groupId, playerId: String(playerId) } },
      select: { active: true, player: { select: { name: true } } },
    });
    if (!m) throw new UserError("Este jogador não é membro do teu grupo.");
    if (!m.active) throw new UserError(`${m.player.name} já não está no grupo.`);
    const o = await memberObligations(groupId, playerId);
    if (hasObligations(o)) {
      throw new UserError(`Ainda não dá para remover ${m.player.name}: ${describeObligations(o, m.player.name).join(" ")}`, "has_debts");
    }
    await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { groupId_playerId: { groupId, playerId } }, data: { active: false } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId,
        action: "group.removeMember",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) removeu ${m.player.name} do grupo`,
      });
    });
    return {};
  });
  if (r.ok) refresh();
  return r;
}

/** Voltar a juntar ao grupo alguém que foi removido (só admin). */
export async function readmitMember(playerId: string): Promise<ActionResult> {
  const r = await run(async () => {
    const { viewer, groupId } = await requireAdmin();
    await db.$transaction(async (tx) => {
      const t = await memberForAdmin(tx, groupId, viewer.id, playerId);
      await tx.membership.update({ where: { groupId_playerId: { groupId, playerId } }, data: { active: true } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId,
        action: "group.addMember",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) voltou a juntar ${t.name} ao grupo`,
      });
    });
    return {};
  });
  if (r.ok) refresh();
  return r;
}

/** Admin define um PIN novo para um membro (que se esqueceu). Termina as sessões dessa pessoa. */
export async function resetMemberPin(playerId: string, pin: string): Promise<ActionResult> {
  const r = await run(async () => {
    const { viewer, groupId } = await requireAdmin();
    const err = validatePin(pin);
    if (err) throw new UserError(err);
    await db.$transaction(async (tx) => {
      const t = await memberForAdmin(tx, groupId, viewer.id, playerId);
      if (!t.canManage) throw new UserError(OTHER_GROUP, "forbidden");
      await tx.player.update({ where: { id: playerId }, data: { pinHash: hashPin(pin), ...AFTER_SUCCESS } });
      await tx.authSession.deleteMany({ where: { playerId } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId,
        action: "player.resetPin",
        entityType: "player",
        entityId: playerId,
        summary: `${viewer.name} (admin) definiu um PIN novo para ${t.name}`,
      });
    });
    return {};
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/**
 * Qualquer membro junta alguém ao grupo: se o nome já existe (pessoa de outro grupo), junta essa pessoa;
 * se não existe, cria o perfil (sem PIN: define-o no primeiro acesso).
 */
export async function addMember(_: unknown, form: FormData): Promise<ActionResult & { created?: boolean }> {
  let created = false;
  const r = await run(async () => {
    const { viewer, groupId } = await requireGroupMember();
    const v = validateName(form.get("name"));
    if ("error" in v) throw new UserError(v.error);
    await db.$transaction(async (tx) => {
      let p = await tx.player.findUnique({ where: { nameKey: v.key }, select: { id: true, name: true, active: true } });
      if (p && !p.active) throw new UserError(`O perfil de ${p.name} está desativado.`);
      if (!p) {
        const out = await createPlayer(prismaPlayerStore(tx), v.name, viewer.id);
        if (!out.ok) throw new UserError(out.error);
        p = { id: out.player.id, name: out.player.name, active: true };
        created = true;
      }
      const existing = await tx.membership.findUnique({
        where: { groupId_playerId: { groupId, playerId: p.id } },
        select: { active: true },
      });
      if (existing?.active) throw new UserError(`${p.name} já é membro deste grupo.`);
      if (existing) await tx.membership.update({ where: { groupId_playerId: { groupId, playerId: p.id } }, data: { active: true } });
      else await tx.membership.create({ data: { groupId, playerId: p.id } });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId,
        action: "group.addMember",
        entityType: "player",
        entityId: p.id,
        summary: `${viewer.name} juntou ${p.name} ao grupo`,
      });
    });
    return {};
  });
  if (r.ok) refresh();
  return { ...r, created };
}
