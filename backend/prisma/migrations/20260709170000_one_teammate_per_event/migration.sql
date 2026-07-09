-- One player may appear as teammate on only one registration per event.
-- Keep the newest row when duplicates already exist.
DELETE FROM "EventRegistration" AS older
USING "EventRegistration" AS newer
WHERE older."eventId" = newer."eventId"
  AND older."teammateId" = newer."teammateId"
  AND older."createdAt" < newer."createdAt";

CREATE UNIQUE INDEX "EventRegistration_eventId_teammateId_key"
  ON "EventRegistration"("eventId", "teammateId");
