-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "sealedAt" TIMESTAMP(3),
ADD COLUMN     "sealedByPlayerId" TEXT;

-- CreateIndex
CREATE INDEX "Session_sealedByPlayerId_idx" ON "Session"("sealedByPlayerId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_sealedByPlayerId_fkey" FOREIGN KEY ("sealedByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
