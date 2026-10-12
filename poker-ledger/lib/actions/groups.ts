"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import { run, UserError, type ActionResult } from "../errors";
import { getViewer, requirePlayer } from "../identity";
import { setGroupCookie } from "../group";
import { logActivity } from "../activity";

/** Criar um grupo: quem cria fica automaticamente admin desse grupo (e só desse). */
export async function createGroup(_: unknown, form: FormData): Promise<ActionResult> {
  let groupId = "";
  const r = await run(async () => {
    const viewer = await requirePlayer();
    const name = String(form.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 40) throw new UserError("O nome do grupo tem de ter entre 2 e 40 caracteres.");
    groupId = await db.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: { name, createdByPlayerId: viewer.id, memberships: { create: { playerId: viewer.id, role: "ADMIN" } } },
        select: { id: true },
      });
      await logActivity(tx, {
        actorPlayerId: viewer.id,
        groupId: g.id,
        action: "group.create",
        entityType: "player",
        entityId: viewer.id,
        summary: `${viewer.name} criou o grupo “${name}”`,
      });
      return g.id;
    });
    await setGroupCookie(groupId);
    return {};
  });
  if (r.ok) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  return r;
}

/** Mudar de grupo: só para um grupo onde a pessoa é membro ativo (senão não muda nada). */
export async function switchGroup(groupId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/quem-es");
  const m = await db.membership.findUnique({
    where: { groupId_playerId: { groupId: String(groupId), playerId: viewer.id } },
    select: { active: true },
  });
  if (!m?.active) redirect("/grupos");
  await setGroupCookie(String(groupId));
  revalidatePath("/", "layout");
  redirect("/");
}
