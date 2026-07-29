-- Organisers run one event at a time. They hold no global capability: every
-- power they have is checked against an EventOrganiser link, and the judges
-- they may assign are limited to that event's EventJudge pool.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ORGANISER';

-- CreateTable
CREATE TABLE "EventOrganiser" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EventOrganiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventJudge" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EventJudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventOrganiser_userId_revokedAt_idx" ON "EventOrganiser"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "EventOrganiser_eventId_revokedAt_idx" ON "EventOrganiser"("eventId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrganiser_eventId_userId_key" ON "EventOrganiser"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventJudge_userId_revokedAt_idx" ON "EventJudge"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "EventJudge_eventId_revokedAt_idx" ON "EventJudge"("eventId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventJudge_eventId_userId_key" ON "EventJudge"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "EventOrganiser" ADD CONSTRAINT "EventOrganiser_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrganiser" ADD CONSTRAINT "EventOrganiser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrganiser" ADD CONSTRAINT "EventOrganiser_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the judge pool from live events. Judge assignment now requires an
-- EventJudge row, so every judge already holding a court assignment or named on
-- a schedule item must be admitted to that event's pool or in-flight events
-- would break the first time someone edited the schedule.
INSERT INTO "EventJudge" ("id", "eventId", "userId", "createdById", "createdAt")
SELECT
    gen_random_uuid()::TEXT,
    pool."eventId",
    pool."userId",
    NULL,
    CURRENT_TIMESTAMP
FROM (
    SELECT c."eventId" AS "eventId", a."judgeUserId" AS "userId"
    FROM "CourtJudgeAssignment" a
    JOIN "Court" c ON c."id" = a."courtId"
    WHERE a."revokedAt" IS NULL
    UNION
    SELECT c."eventId" AS "eventId", s."assignedJudgeId" AS "userId"
    FROM "ScheduleItem" s
    JOIN "Court" c ON c."id" = s."courtId"
    WHERE s."assignedJudgeId" IS NOT NULL
) AS pool
ON CONFLICT ("eventId", "userId") DO NOTHING;
