-- CreateEnum
CREATE TYPE "ClubMembershipRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClubJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ClubMember"
ADD COLUMN "membershipRole" "ClubMembershipRole" NOT NULL DEFAULT 'MEMBER';

-- Preserve existing clubs by promoting their earliest member to leader.
WITH ranked_members AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "clubId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS member_rank
  FROM "ClubMember"
)
UPDATE "ClubMember"
SET "membershipRole" = 'LEADER'
FROM ranked_members
WHERE "ClubMember"."id" = ranked_members."id"
  AND ranked_members.member_rank = 1;

-- CreateTable
CREATE TABLE "ClubJoinRequest" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ClubJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClubJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubJoinRequest_clubId_userId_key" ON "ClubJoinRequest"("clubId", "userId");

-- CreateIndex
CREATE INDEX "ClubJoinRequest_clubId_status_createdAt_idx" ON "ClubJoinRequest"("clubId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ClubJoinRequest_userId_status_idx" ON "ClubJoinRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "ClubJoinRequest"
ADD CONSTRAINT "ClubJoinRequest_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubJoinRequest"
ADD CONSTRAINT "ClubJoinRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
