import { db } from "@/lib/db";
import { getViewerIdCookie } from "@/lib/identity";
import type { SessionVersion } from "@/lib/live/poller";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Versão da sessão para as páginas abertas saberem se mudou. Sem valores nem nomes. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getViewerIdCookie())) return Response.json({ error: "no_profile" }, { status: 401, headers: NO_STORE });
  const { id } = await params;
  const s = await db.session.findUnique({
    where: { id },
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
