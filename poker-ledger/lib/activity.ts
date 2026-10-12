import type { Prisma } from "@prisma/client";

export type ActivityInput = {
  actorPlayerId: string;
  action: string;
  entityType: "player" | "session" | "buyin" | "sessionPlayer" | "settlement" | "transfer" | "group";
  entityId: string;
  summary: string;
  /** Grupo onde aconteceu (null = evento pessoal, ex.: criar perfil ou definir PIN). */
  groupId?: string | null;
};

/** Regista quem fez o quê. Chamar dentro da mesma transação da escrita. */
export function logActivity(tx: Prisma.TransactionClient, data: ActivityInput) {
  return tx.activityLog.create({ data, select: { id: true } });
}
