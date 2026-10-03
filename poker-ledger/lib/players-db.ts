import { Prisma } from "@prisma/client";
import { db } from "./db";
import { DuplicateKeyError, type PlayerStore } from "./players";

const summary = { id: true, name: true, avatarColor: true, active: true } as const;

export function prismaPlayerStore(client: Prisma.TransactionClient = db): PlayerStore {
  return {
    findByKey: (key) => client.player.findUnique({ where: { nameKey: key }, select: summary }),
    count: () => client.player.count(),
    async create(data) {
      try {
        return await client.player.create({ data, select: summary });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new DuplicateKeyError();
        }
        throw e;
      }
    },
  };
}
