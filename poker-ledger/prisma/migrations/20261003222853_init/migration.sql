-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ibanOrMbway" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByPlayerId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "defaultBuyIn" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByPlayerId" TEXT NOT NULL,
    "settlementId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cashOut" INTEGER,

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyIn" (
    "id" TEXT NOT NULL,
    "sessionPlayerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorPlayerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_nameKey_key" ON "Player"("nameKey");

-- CreateIndex
CREATE INDEX "Player_createdByPlayerId_idx" ON "Player"("createdByPlayerId");

-- CreateIndex
CREATE INDEX "Session_settlementId_idx" ON "Session"("settlementId");

-- CreateIndex
CREATE INDEX "Session_createdByPlayerId_idx" ON "Session"("createdByPlayerId");

-- CreateIndex
CREATE INDEX "Session_date_idx" ON "Session"("date");

-- CreateIndex
CREATE INDEX "SessionPlayer_playerId_idx" ON "SessionPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayer_sessionId_playerId_key" ON "SessionPlayer"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "BuyIn_sessionPlayerId_idx" ON "BuyIn"("sessionPlayerId");

-- CreateIndex
CREATE INDEX "Settlement_closedAt_idx" ON "Settlement"("closedAt");

-- CreateIndex
CREATE INDEX "Transfer_settlementId_idx" ON "Transfer"("settlementId");

-- CreateIndex
CREATE INDEX "Transfer_fromPlayerId_idx" ON "Transfer"("fromPlayerId");

-- CreateIndex
CREATE INDEX "Transfer_toPlayerId_idx" ON "Transfer"("toPlayerId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorPlayerId_idx" ON "ActivityLog"("actorPlayerId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_createdByPlayerId_fkey" FOREIGN KEY ("createdByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_createdByPlayerId_fkey" FOREIGN KEY ("createdByPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyIn" ADD CONSTRAINT "BuyIn_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
