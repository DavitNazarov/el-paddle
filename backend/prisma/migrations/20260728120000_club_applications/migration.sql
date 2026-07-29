-- Club onboarding is now reviewed by an admin. An application is held entirely
-- outside User/Club/ClubMember until approval, so rejecting one deletes every
-- trace of it and leaves the email address free to apply again.

-- CreateEnum
CREATE TYPE "ClubApplicationStatus" AS ENUM ('PENDING_VERIFICATION', 'SUBMITTED');

-- AlterEnum
ALTER TYPE "Capability" ADD VALUE 'CLUB_APPLICATION_REVIEW';

-- CreateTable
CREATE TABLE "ClubApplication" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleAccountId" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "privacyAcknowledgedAt" TIMESTAMP(3),
    "privacyVersion" TEXT,
    "eligibilityConfirmedAt" TIMESTAMP(3),
    "clubName" TEXT,
    "clubDescription" TEXT,
    "mateEmail" TEXT,
    "mateName" TEXT,
    "mateSurname" TEXT,
    "matePhone" TEXT,
    "status" "ClubApplicationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubApplicationCode" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubApplicationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubApplicationMessage" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubApplicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubApplication_email_key" ON "ClubApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClubApplication_googleAccountId_key" ON "ClubApplication"("googleAccountId");

-- CreateIndex
CREATE INDEX "ClubApplication_status_submittedAt_idx" ON "ClubApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "ClubApplication_status_expiresAt_idx" ON "ClubApplication"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ClubApplicationCode_applicationId_usedAt_createdAt_idx" ON "ClubApplicationCode"("applicationId", "usedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ClubApplicationMessage_applicationId_sentAt_idx" ON "ClubApplicationMessage"("applicationId", "sentAt");

-- AddForeignKey
ALTER TABLE "ClubApplicationCode" ADD CONSTRAINT "ClubApplicationCode_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ClubApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubApplicationMessage" ADD CONSTRAINT "ClubApplicationMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ClubApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubApplicationMessage" ADD CONSTRAINT "ClubApplicationMessage_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
