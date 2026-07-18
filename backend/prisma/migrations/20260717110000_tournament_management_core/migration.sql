-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('EVENT_STATUS_MANAGE', 'EVENT_STATE_CORRECT', 'EVENT_PUBLISH', 'REGISTRATION_REVIEW', 'REGISTRATION_CORRECT', 'OPPONENT_REQUEST_MANAGE', 'OPPONENT_REQUEST_DECIDE', 'OPPONENT_REQUEST_OVERRIDE', 'BRACKET_MANAGE', 'BRACKET_PUBLISH', 'JUDGE_MANAGE', 'SCHEDULE_MANAGE', 'SCHEDULE_PUBLISH', 'MATCH_RESULT_ADMIN', 'MATCH_RESULT_CORRECT', 'AUDIT_READ', 'DELIVERY_MONITOR');

-- CreateEnum
CREATE TYPE "CapabilityEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "OpponentRequestStatus" AS ENUM ('PENDING_RESPONSE', 'ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'WITHDRAWN_BY_REQUESTER', 'EXPIRED', 'CONFLICTED', 'APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN', 'REJECTED_BY_ADMIN', 'APPLIED_TO_BRACKET');

-- CreateEnum
CREATE TYPE "BracketStatus" AS ENUM ('DRAFT', 'LOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchRound" AS ENUM ('ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchResultType" AS ENUM ('NORMAL', 'BYE', 'WALKOVER', 'DISQUALIFICATION', 'WITHDRAWAL', 'ADMIN_DECISION');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "ScoreAction" AS ENUM ('INCREMENT', 'DECREMENT');

-- CreateEnum
CREATE TYPE "ScheduleItemStatus" AS ENUM ('TENTATIVE', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION_PENDING', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'REGISTRATION_NEEDS_CHANGES', 'REGISTRATION_WAITLISTED', 'REGISTRATION_WITHDRAWN', 'REGISTRATION_CANCELLED', 'OPPONENT_REQUEST_CREATED', 'OPPONENT_REQUEST_ACCEPTED', 'OPPONENT_REQUEST_REFUSED', 'OPPONENT_REQUEST_WITHDRAWN', 'OPPONENT_REQUEST_EXPIRED', 'OPPONENT_REQUEST_APPROVED_BY_ADMIN', 'OPPONENT_REQUEST_REJECTED_BY_ADMIN', 'OPPONENT_REQUEST_OVERRIDDEN_BY_ADMIN', 'OPPONENT_REQUEST_APPLIED_TO_BRACKET', 'BRACKET_PUBLISHED', 'SCHEDULE_PUBLISHED', 'MATCH_SCHEDULED', 'MATCH_RESCHEDULED', 'MATCH_STARTED', 'MATCH_COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'JUDGE';

ALTER TYPE "UserStatus" ADD VALUE 'INACTIVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegistrationStatus" ADD VALUE 'NEEDS_CHANGES';
ALTER TYPE "RegistrationStatus" ADD VALUE 'WAITLISTED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'WITHDRAWN';
ALTER TYPE "RegistrationStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "publicLiveScoringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationClosedAt" TIMESTAMP(3),
ADD COLUMN     "resultsPublishedAt" TIMESTAMP(3),
ADD COLUMN     "schedulePublishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'REGISTRATION_OPEN',
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tbilisi',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN     "opponentRequestDeadline" TIMESTAMP(3),
ADD COLUMN     "opponentRequestVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opponentRequestsClosedAt" TIMESTAMP(3),
ADD COLUMN     "opponentRequestsOpenedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "internalReviewNote" TEXT,
ADD COLUMN     "publicStatusReason" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserCapabilityGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capability" "Capability" NOT NULL,
    "effect" "CapabilityEffect" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCapabilityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventStatusHistory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromStatus" "EventStatus" NOT NULL,
    "toStatus" "EventStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "commandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationStatusHistory" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "fromStatus" "RegistrationStatus" NOT NULL,
    "toStatus" "RegistrationStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "publicReason" TEXT,
    "internalNote" TEXT,
    "commandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "requestingEntryId" TEXT NOT NULL,
    "targetEntryId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "OpponentRequestStatus" NOT NULL DEFAULT 'PENDING_RESPONSE',
    "requestMessage" TEXT,
    "responseReason" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "adminDecisionByUserId" TEXT,
    "adminDecisionAt" TIMESTAMP(3),
    "adminPublicReason" TEXT,
    "adminInternalNote" TEXT,
    "canonicalPairKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "appliedMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 16,
    "status" "BracketStatus" NOT NULL DEFAULT 'DRAFT',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "generationSeed" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "round" "MatchRound" NOT NULL,
    "roundPosition" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "participantAEntryId" TEXT,
    "participantBEntryId" TEXT,
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "winnerEntryId" TEXT,
    "loserEntryId" TEXT,
    "nextMatchId" TEXT,
    "nextMatchSlot" "MatchSide",
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "resultType" "MatchResultType",
    "resultReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchParticipantSnapshot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "entryId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "teammateUserId" TEXT NOT NULL,
    "teammateName" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchParticipantSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtJudgeAssignment" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "judgeUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "assignedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtJudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "assignedJudgeId" TEXT,
    "queuePosition" INTEGER NOT NULL,
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "status" "ScheduleItemStatus" NOT NULL DEFAULT 'TENTATIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "judgeUserId" TEXT NOT NULL,
    "action" "ScoreAction" NOT NULL,
    "side" "MatchSide" NOT NULL,
    "scoreABefore" INTEGER NOT NULL,
    "scoreAAfter" INTEGER NOT NULL,
    "scoreBBefore" INTEGER NOT NULL,
    "scoreBAfter" INTEGER NOT NULL,
    "matchVersion" INTEGER NOT NULL,
    "commandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventId" TEXT,
    "actionPath" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandReceipt" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "eventId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "publicReason" TEXT,
    "internalReason" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCapabilityGrant_userId_capability_key" ON "UserCapabilityGrant"("userId", "capability");

-- CreateIndex
CREATE INDEX "EventStatusHistory_eventId_createdAt_idx" ON "EventStatusHistory"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventStatusHistory_actorId_commandId_key" ON "EventStatusHistory"("actorId", "commandId");

-- CreateIndex
CREATE INDEX "RegistrationStatusHistory_registrationId_createdAt_idx" ON "RegistrationStatusHistory"("registrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationStatusHistory_actorId_commandId_key" ON "RegistrationStatusHistory"("actorId", "commandId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentRequest_appliedMatchId_key" ON "OpponentRequest"("appliedMatchId");

-- CreateIndex
CREATE INDEX "OpponentRequest_eventId_categoryId_status_idx" ON "OpponentRequest"("eventId", "categoryId", "status");

-- CreateIndex
CREATE INDEX "OpponentRequest_requestingEntryId_status_idx" ON "OpponentRequest"("requestingEntryId", "status");

-- CreateIndex
CREATE INDEX "OpponentRequest_targetEntryId_status_idx" ON "OpponentRequest"("targetEntryId", "status");

-- CreateIndex
CREATE INDEX "OpponentRequest_canonicalPairKey_status_idx" ON "OpponentRequest"("canonicalPairKey", "status");

-- CreateIndex
CREATE INDEX "Bracket_eventId_status_idx" ON "Bracket"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_eventId_categoryId_generation_key" ON "Bracket"("eventId", "categoryId", "generation");

-- CreateIndex
CREATE INDEX "Match_status_startedAt_idx" ON "Match"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Match_participantAEntryId_completedAt_idx" ON "Match"("participantAEntryId", "completedAt");

-- CreateIndex
CREATE INDEX "Match_participantBEntryId_completedAt_idx" ON "Match"("participantBEntryId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_bracketId_round_roundPosition_key" ON "Match"("bracketId", "round", "roundPosition");

-- CreateIndex
CREATE UNIQUE INDEX "Match_bracketId_matchNumber_key" ON "Match"("bracketId", "matchNumber");

-- CreateIndex
CREATE INDEX "MatchParticipantSnapshot_ownerUserId_createdAt_idx" ON "MatchParticipantSnapshot"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchParticipantSnapshot_teammateUserId_createdAt_idx" ON "MatchParticipantSnapshot"("teammateUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchParticipantSnapshot_clubId_createdAt_idx" ON "MatchParticipantSnapshot"("clubId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipantSnapshot_matchId_side_key" ON "MatchParticipantSnapshot"("matchId", "side");

-- CreateIndex
CREATE INDEX "Court_eventId_active_idx" ON "Court"("eventId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Court_eventId_name_key" ON "Court"("eventId", "name");

-- CreateIndex
CREATE INDEX "CourtJudgeAssignment_judgeUserId_startsAt_endsAt_idx" ON "CourtJudgeAssignment"("judgeUserId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CourtJudgeAssignment_courtId_startsAt_idx" ON "CourtJudgeAssignment"("courtId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_matchId_key" ON "ScheduleItem"("matchId");

-- CreateIndex
CREATE INDEX "ScheduleItem_assignedJudgeId_plannedStartAt_idx" ON "ScheduleItem"("assignedJudgeId", "plannedStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_courtId_queuePosition_key" ON "ScheduleItem"("courtId", "queuePosition");

-- CreateIndex
CREATE INDEX "ScoreEvent_matchId_createdAt_idx" ON "ScoreEvent"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEvent_judgeUserId_commandId_key" ON "ScoreEvent"("judgeUserId", "commandId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_eventId_createdAt_idx" ON "Notification"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_deduplicationKey_key" ON "EmailDelivery"("deduplicationKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_deduplicationKey_key" ON "OutboxMessage"("deduplicationKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_availableAt_idx" ON "OutboxMessage"("status", "availableAt");

-- CreateIndex
CREATE INDEX "CommandReceipt_expiresAt_idx" ON "CommandReceipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommandReceipt_actorId_action_commandId_key" ON "CommandReceipt"("actorId", "action", "commandId");

-- CreateIndex
CREATE INDEX "AuditLog_eventId_action_createdAt_idx" ON "AuditLog"("eventId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserCapabilityGrant" ADD CONSTRAINT "UserCapabilityGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStatusHistory" ADD CONSTRAINT "EventStatusHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationStatusHistory" ADD CONSTRAINT "RegistrationStatusHistory_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_eventId_categoryId_fkey" FOREIGN KEY ("eventId", "categoryId") REFERENCES "EventCategory"("eventId", "categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_requestingEntryId_fkey" FOREIGN KEY ("requestingEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_appliedMatchId_fkey" FOREIGN KEY ("appliedMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_eventId_categoryId_fkey" FOREIGN KEY ("eventId", "categoryId") REFERENCES "EventCategory"("eventId", "categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_participantAEntryId_fkey" FOREIGN KEY ("participantAEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_participantBEntryId_fkey" FOREIGN KEY ("participantBEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_loserEntryId_fkey" FOREIGN KEY ("loserEntryId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipantSnapshot" ADD CONSTRAINT "MatchParticipantSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtJudgeAssignment" ADD CONSTRAINT "CourtJudgeAssignment_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtJudgeAssignment" ADD CONSTRAINT "CourtJudgeAssignment_judgeUserId_fkey" FOREIGN KEY ("judgeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_judgeUserId_fkey" FOREIGN KEY ("judgeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express directly.
ALTER TABLE "OpponentRequest" ADD CONSTRAINT "OpponentRequest_distinct_entries_check"
  CHECK ("requestingEntryId" <> "targetEntryId");

ALTER TABLE "Match" ADD CONSTRAINT "Match_scoreA_range_check" CHECK ("scoreA" BETWEEN 0 AND 6);
ALTER TABLE "Match" ADD CONSTRAINT "Match_scoreB_range_check" CHECK ("scoreB" BETWEEN 0 AND 6);

CREATE UNIQUE INDEX "OpponentRequest_one_active_outgoing_entry_idx"
  ON "OpponentRequest" ("requestingEntryId")
  WHERE "status" IN ('PENDING_RESPONSE', 'ACCEPTED_BY_OPPONENT', 'APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN');

CREATE UNIQUE INDEX "OpponentRequest_one_active_canonical_pair_idx"
  ON "OpponentRequest" ("eventId", "categoryId", "canonicalPairKey")
  WHERE "status" IN ('PENDING_RESPONSE', 'ACCEPTED_BY_OPPONENT', 'APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN');

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "CourtJudgeAssignment" ADD CONSTRAINT "CourtJudgeAssignment_no_active_overlap"
  EXCLUDE USING gist (
    "judgeUserId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("revokedAt" IS NULL);
