-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "clubId" TEXT;

-- Associate existing entries with the current club of either participant.
UPDATE "EventRegistration" AS registration
SET "clubId" = COALESCE(
  (
    SELECT membership."clubId"
    FROM "ClubMember" AS membership
    WHERE membership."userId" = registration."ownerId"
    LIMIT 1
  ),
  (
    SELECT membership."clubId"
    FROM "ClubMember" AS membership
    WHERE membership."userId" = registration."teammateId"
    LIMIT 1
  )
);

-- CreateIndex
CREATE INDEX "EventRegistration_clubId_status_createdAt_idx"
ON "EventRegistration"("clubId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "EventRegistration"
ADD CONSTRAINT "EventRegistration_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
