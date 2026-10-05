-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastActorPlayerId" TEXT,
ADD COLUMN     "lastChangeType" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
