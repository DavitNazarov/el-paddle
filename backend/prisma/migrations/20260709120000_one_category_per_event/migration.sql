-- One team (owner) may enter only one category per event.
DROP INDEX IF EXISTS "EventRegistration_eventId_categoryId_ownerId_key";

-- Keep a single row per owner/event if duplicates already exist.
DELETE FROM "EventRegistration" AS older
USING "EventRegistration" AS newer
WHERE older."eventId" = newer."eventId"
  AND older."ownerId" = newer."ownerId"
  AND older."createdAt" < newer."createdAt";

CREATE UNIQUE INDEX "EventRegistration_eventId_ownerId_key" ON "EventRegistration"("eventId", "ownerId");
