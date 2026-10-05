import type { Prisma } from "@prisma/client";

export const CHANGE_TYPES = [
  "rebuy_added",
  "rebuy_removed",
  "cashout_set",
  "player_added",
  "player_removed",
  "session_edited",
  "adjustment_confirmed",
  "adjustment_undone",
  "session_settled",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/**
 * Sobe a versão da(s) sessão(ões) e guarda quem mudou e o quê. Chamar DENTRO da transação da escrita:
 * se a escrita falhar, a versão também não sobe. As páginas abertas comparam a versão (rota /api/sessions/[id]/version).
 */
export async function bumpSessionVersion(
  tx: Prisma.TransactionClient,
  { sessionId, actorPlayerId, type }: { sessionId: string | string[]; actorPlayerId: string; type: ChangeType },
) {
  const ids = Array.isArray(sessionId) ? sessionId : [sessionId];
  if (ids.length === 0) return;
  await tx.session.updateMany({
    where: { id: { in: ids } },
    data: { version: { increment: 1 }, lastActorPlayerId: actorPlayerId, lastChangeType: type },
  });
}
