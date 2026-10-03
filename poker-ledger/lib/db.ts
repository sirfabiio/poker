import { PrismaClient } from "@prisma/client";

// Singleton: em serverless e em dev (hot reload) reutiliza a mesma instância
// para não esgotar as ligações à base de dados.
const g = globalThis as unknown as { prisma?: PrismaClient };

export const db = g.prisma ?? new PrismaClient();
g.prisma = db;
