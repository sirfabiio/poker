// ÚNICO módulo com a verificação de admin: admin = papel ADMIN no grupo ativo (validado no servidor).
import { UserError } from "./errors";
import { getGroupContext, requireGroupMember, type GroupContext } from "./group";

export async function isAdmin(): Promise<boolean> {
  return (await getGroupContext())?.role === "ADMIN";
}

/** Exige admin do grupo ativo; devolve o contexto (as ações de admin só valem dentro deste grupo). */
export async function requireAdmin(): Promise<GroupContext> {
  const ctx = await requireGroupMember();
  if (ctx.role !== "ADMIN") throw new UserError("Esta ação é só para o admin do grupo.", "not_admin");
  return ctx;
}

/**
 * Um admin só pode mexer na conta de um jogador (nome, PIN) se TODOS os grupos desse jogador forem
 * grupos onde é admin. Assim, o admin de um grupo nunca altera uma pessoa que também está noutro grupo.
 */
export function canManageAccount(targetGroupIds: readonly string[], adminGroupIds: readonly string[]): boolean {
  const admin = new Set(adminGroupIds);
  return targetGroupIds.length > 0 && targetGroupIds.every((g) => admin.has(g));
}
