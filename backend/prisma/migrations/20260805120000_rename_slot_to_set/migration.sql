-- Rename the scoring "slot" vocabulary to "set", the correct padel term.
-- Renames only: every row of recorded match history is preserved.
--
-- Match.nextMatchSlot is deliberately untouched. It names the side of the next
-- match a winner advances into, not a scoring set.

-- Enums
ALTER TYPE "ScoringMode" RENAME VALUE 'SLOTS' TO 'SETS';
ALTER TYPE "SlotEventAction" RENAME TO "SetEventAction";

-- Match / BracketRoundConfig columns
ALTER TABLE "Match" RENAME COLUMN "slotCount" TO "setCount";
ALTER TABLE "Match" RENAME COLUMN "slotCountOverride" TO "setCountOverride";
ALTER TABLE "BracketRoundConfig" RENAME COLUMN "slotCount" TO "setCount";

-- MatchSlot -> MatchSet
ALTER TABLE "MatchSlot" RENAME TO "MatchSet";
ALTER TABLE "MatchSet" RENAME COLUMN "slotNumber" TO "setNumber";
ALTER INDEX "MatchSlot_pkey" RENAME TO "MatchSet_pkey";
ALTER INDEX "MatchSlot_matchId_idx" RENAME TO "MatchSet_matchId_idx";
ALTER INDEX "MatchSlot_matchId_slotNumber_key" RENAME TO "MatchSet_matchId_setNumber_key";
ALTER TABLE "MatchSet" RENAME CONSTRAINT "MatchSlot_matchId_fkey" TO "MatchSet_matchId_fkey";
ALTER TABLE "MatchSet" RENAME CONSTRAINT "MatchSlot_decidedById_fkey" TO "MatchSet_decidedById_fkey";

-- SlotEvent -> SetEvent
ALTER TABLE "SlotEvent" RENAME TO "SetEvent";
ALTER TABLE "SetEvent" RENAME COLUMN "slotNumber" TO "setNumber";
ALTER TABLE "SetEvent" RENAME COLUMN "slotsABefore" TO "setsABefore";
ALTER TABLE "SetEvent" RENAME COLUMN "slotsBBefore" TO "setsBBefore";
ALTER TABLE "SetEvent" RENAME COLUMN "slotsAAfter" TO "setsAAfter";
ALTER TABLE "SetEvent" RENAME COLUMN "slotsBAfter" TO "setsBAfter";
ALTER INDEX "SlotEvent_pkey" RENAME TO "SetEvent_pkey";
ALTER INDEX "SlotEvent_matchId_createdAt_idx" RENAME TO "SetEvent_matchId_createdAt_idx";
ALTER INDEX "SlotEvent_actorId_commandId_key" RENAME TO "SetEvent_actorId_commandId_key";
ALTER TABLE "SetEvent" RENAME CONSTRAINT "SlotEvent_matchId_fkey" TO "SetEvent_matchId_fkey";
ALTER TABLE "SetEvent" RENAME CONSTRAINT "SlotEvent_actorId_fkey" TO "SetEvent_actorId_fkey";
