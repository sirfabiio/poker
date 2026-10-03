import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { UserError } from "./errors";

// Identificação (não autenticação): o perfil escolhido fica num cookie de longa duração.
const COOKIE = "pl_player";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Viewer = { id: string; name: string; avatarColor: string; ibanOrMbway: string | null };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const p = await db.player.findUnique({
    where: { id },
    select: { id: true, name: true, avatarColor: true, ibanOrMbway: true, active: true },
  });
  if (!p || !p.active) return null;
  return { id: p.id, name: p.name, avatarColor: p.avatarColor, ibanOrMbway: p.ibanOrMbway };
});

/** Para páginas: sem perfil escolhido vai para "Quem és tu?". */
export async function requireViewerPage(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/quem-es");
  return v;
}

/** Para escritas: rejeita pedidos sem perfil válido. */
export async function requirePlayer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new UserError("Escolhe primeiro o teu perfil.", "no_profile");
  return v;
}

export async function setViewerCookie(playerId: string) {
  (await cookies()).set(COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}

export async function clearViewerCookie() {
  (await cookies()).delete(COOKIE);
}
