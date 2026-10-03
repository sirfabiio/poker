-- CreateEnum
CREATE TYPE "AdjustmentMethod" AS ENUM ('EQUAL', 'PROPORTIONAL', 'SINGLE_PLAYER');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "adjustmentMethod" "AdjustmentMethod",
ADD COLUMN     "adjustmentPlayerId" TEXT,
ADD COLUMN     "discrepancy" INTEGER,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledByPlayerId" TEXT;

-- AlterTable
ALTER TABLE "SessionPlayer" ADD COLUMN     "adjustment" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Session_adjustmentPlayerId_idx" ON "Session"("adjustmentPlayerId");

-- CreateIndex
CREATE INDEX "Session_reconciledByPlayerId_idx" ON "Session"("reconciledByPlayerId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adjustmentPlayerId_fkey" FOREIGN KEY ("adjustmentPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_reconciledByPlayerId_fkey" FOREIGN KEY ("reconciledByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
