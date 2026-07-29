-- Slot scoring: matches are decided by a race to N slot wins instead of counting points to six.
-- Match.scoreA / scoreB are reused as the slot-win tally for SLOTS matches and must stay in
-- sync with the MatchSlot rows.

-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM ('POINTS', 'SLOTS');

-- CreateEnum
CREATE TYPE "SlotEventAction" AS ENUM ('DECIDED', 'UNDONE');

-- AlterTable
-- Backfill every existing match as POINTS, then flip the default so new matches use slots.
ALTER TABLE "Match" ADD COLUMN "scoringMode" "ScoringMode" NOT NULL DEFAULT 'POINTS';
ALTER TABLE "Match" ALTER COLUMN "scoringMode" SET DEFAULT 'SLOTS';
ALTER TABLE "Match" ADD COLUMN "slotCount" INTEGER;
ALTER TABLE "Match" ADD COLUMN "slotCountOverride" INTEGER;

-- CreateTable
CREATE TABLE "BracketRoundConfig" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "round" "MatchRound" NOT NULL,
    "slotCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketRoundConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSlot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "winnerSide" "MatchSide" NOT NULL,
    "winnerEntryId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "SlotEventAction" NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "winnerSide" "MatchSide" NOT NULL,
    "winnerEntryId" TEXT NOT NULL,
    "slotsABefore" INTEGER NOT NULL,
    "slotsBBefore" INTEGER NOT NULL,
    "slotsAAfter" INTEGER NOT NULL,
    "slotsBAfter" INTEGER NOT NULL,
    "matchVersion" INTEGER NOT NULL,
    "commandId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketRoundConfig_bracketId_round_key" ON "BracketRoundConfig"("bracketId", "round");

-- CreateIndex
CREATE INDEX "MatchSlot_matchId_idx" ON "MatchSlot"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSlot_matchId_slotNumber_key" ON "MatchSlot"("matchId", "slotNumber");

-- CreateIndex
CREATE INDEX "SlotEvent_matchId_createdAt_idx" ON "SlotEvent"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlotEvent_actorId_commandId_key" ON "SlotEvent"("actorId", "commandId");

-- AddForeignKey
ALTER TABLE "BracketRoundConfig" ADD CONSTRAINT "BracketRoundConfig_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSlot" ADD CONSTRAINT "MatchSlot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSlot" ADD CONSTRAINT "MatchSlot_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotEvent" ADD CONSTRAINT "SlotEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotEvent" ADD CONSTRAINT "SlotEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
