-- Platform statistics tracking.
--
-- `lastLoginAt` is nullable, so this ALTER is metadata-only and does not rewrite
-- the table. Every index below exists because the table's current indexes lead
-- with a scope column (role/eventId/clubId/status) and therefore cannot serve a
-- platform-wide range on a timestamp.
--
-- CREATE INDEX CONCURRENTLY is deliberately NOT used: it cannot run inside a
-- transaction, and Prisma wraps each migration in one. At this data volume the
-- brief write lock is acceptable. Do not "fix" this.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_createdAt_idx" ON "EmailDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "EventRegistration_createdAt_idx" ON "EventRegistration"("createdAt");

-- CreateIndex
CREATE INDEX "EventRegistration_reviewedAt_idx" ON "EventRegistration"("reviewedAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_provider_createdAt_idx" ON "OAuthAccount"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");
