import type { Prisma } from "@prisma/client";

export type ActivityInput = {
  actorPlayerId: string;
  action: string;
  entityType: "player" | "session" | "buyin" | "sessionPlayer" | "settlement" | "transfer";
  entityId: string;
  summary: string;
};

/** Regista quem fez o quê. Chamar dentro da mesma transação da escrita. */
export function logActivity(tx: Prisma.TransactionClient, data: ActivityInput) {
  return tx.activityLog.create({ data, select: { id: true } });
}
