import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { UserError } from "./errors";
import { hashToken, newSessionToken } from "./pin";

// Autenticação por nome + PIN. O cookie leva um token aleatório; a base de dados guarda só o hash (AuthSession).
const COOKIE = "pl_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Viewer = { id: string; name: string; avatarColor: string; ibanOrMbway: string | null };

async function sessionFromCookie() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      player: { select: { id: true, name: true, avatarColor: true, ibanOrMbway: true, active: true } },
    },
  });
  if (!s || s.expiresAt <= new Date() || !s.player.active) return null;
  return s.player;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const p = await sessionFromCookie();
  return p ? { id: p.id, name: p.name, avatarColor: p.avatarColor, ibanOrMbway: p.ibanOrMbway } : null;
});

/** Id do jogador com sessão válida (para a verificação de versão, que corre a cada 3 s). */
export async function getViewerId(): Promise<string | null> {
  return (await getViewer())?.id ?? null;
}

/** Para páginas: sem sessão iniciada vai para o login. */
export async function requireViewerPage(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/quem-es");
  return v;
}

/** Para escritas: rejeita pedidos sem sessão válida. */
export async function requirePlayer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new UserError("Entra primeiro com o teu nome e PIN.", "no_profile");
  return v;
}

/** Abre uma sessão persistente (1 ano) para o jogador. */
export async function startSession(playerId: string) {
  const { token, tokenHash } = newSessionToken();
  await db.authSession.create({
    data: { tokenHash, playerId, expiresAt: new Date(Date.now() + ONE_YEAR * 1000) },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}

/** Termina a sessão deste dispositivo (apaga-a na base de dados e o cookie). */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}
