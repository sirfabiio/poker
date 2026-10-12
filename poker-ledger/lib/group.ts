import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { UserError } from "./errors";
import { getViewer, type Viewer } from "./identity";

// Grupo ativo: guardado num cookie, mas SEMPRE validado contra a pertença (Membership) no servidor.
const COOKIE = "pl_group";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type GroupRole = "ADMIN" | "MEMBER";
export type GroupContext = { viewer: Viewer; groupId: string; groupName: string; role: GroupRole };

/** Grupos ativos do jogador (por ordem de entrada). */
export function myGroups(playerId: string) {
  return db.membership.findMany({
    where: { playerId, active: true },
    orderBy: { createdAt: "asc" },
    select: { role: true, group: { select: { id: true, name: true } } },
  });
}

export const getGroupContext = cache(async (): Promise<GroupContext | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const wanted = (await cookies()).get(COOKIE)?.value;
  const groups = await myGroups(viewer.id);
  // Sem cookie, ou com um grupo a que já não pertence: usa o primeiro grupo do jogador.
  const m = groups.find((g) => g.group.id === wanted) ?? groups[0];
  if (!m) return null;
  return { viewer, groupId: m.group.id, groupName: m.group.name, role: m.role };
});

/** Para páginas: sem sessão → login; sem grupo → página de grupos. */
export async function requireGroupPage(): Promise<GroupContext> {
  if (!(await getViewer())) redirect("/quem-es");
  const ctx = await getGroupContext();
  if (!ctx) redirect("/grupos");
  return ctx;
}

/** Para escritas: exige sessão iniciada e pertença ativa ao grupo atual. */
export async function requireGroupMember(): Promise<GroupContext> {
  if (!(await getViewer())) throw new UserError("Entra primeiro com o teu nome e PIN.", "no_profile");
  const ctx = await getGroupContext();
  if (!ctx) throw new UserError("Ainda não pertences a nenhum grupo.", "no_group");
  return ctx;
}

export async function setGroupCookie(groupId: string) {
  (await cookies()).set(COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}

export async function clearGroupCookie() {
  (await cookies()).delete(COOKIE);
}
