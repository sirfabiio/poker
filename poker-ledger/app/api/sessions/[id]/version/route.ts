import { db } from "@/lib/db";
import { getViewerId } from "@/lib/identity";
import { getGroupContext } from "@/lib/group";
import type { SessionVersion } from "@/lib/live/poller";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Versão da sessão para as páginas abertas saberem se mudou. Sem valores nem nomes. Só sessões do grupo ativo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getViewerId())) return Response.json({ error: "no_profile" }, { status: 401, headers: NO_STORE });
  const ctx = await getGroupContext();
  if (!ctx) return Response.json({ error: "no_group" }, { status: 403, headers: NO_STORE });
  const { id } = await params;
  // Sessão de outro grupo → 404 (igual a não existir: não revela nada).
  const s = await db.session.findFirst({
    where: { id, groupId: ctx.groupId },
    select: { version: true, lastActorPlayerId: true, lastChangeType: true, settlementId: true },
  });
  if (!s) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  const body: SessionVersion = {
    version: s.version,
    lastActorPlayerId: s.lastActorPlayerId,
    lastChangeType: s.lastChangeType,
    settled: s.settlementId !== null,
  };
  return Response.json(body, { headers: NO_STORE });
}
