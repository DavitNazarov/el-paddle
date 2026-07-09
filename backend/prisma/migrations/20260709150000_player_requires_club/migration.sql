-- Ensure every non-admin player has exactly one club membership.

-- Keep the oldest membership when a user belongs to multiple clubs.
DELETE FROM "ClubMember" AS newer
USING "ClubMember" AS older
WHERE newer."userId" = older."userId"
  AND newer."createdAt" > older."createdAt";

-- Assign remaining clubless players to the first club (by name).
INSERT INTO "ClubMember" ("id", "clubId", "userId", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  (SELECT "id" FROM "Club" ORDER BY "name" ASC LIMIT 1),
  u."id",
  NOW()
FROM "User" u
WHERE u."role" = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM "ClubMember" cm WHERE cm."userId" = u."id"
  )
  AND EXISTS (SELECT 1 FROM "Club");

-- Drop old composite unique, enforce one club per user.
DROP INDEX IF EXISTS "ClubMember_clubId_userId_key";
CREATE UNIQUE INDEX "ClubMember_userId_key" ON "ClubMember"("userId");
CREATE INDEX "ClubMember_clubId_idx" ON "ClubMember"("clubId");
