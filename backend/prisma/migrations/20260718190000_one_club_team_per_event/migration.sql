-- A club submits one doubles team per event. The leader edits that lineup
-- instead of creating another registration from a different member account.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EventRegistration"
    WHERE "clubId" IS NOT NULL
    GROUP BY "eventId", "clubId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one club team per event while duplicate club registrations exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "EventRegistration_eventId_clubId_key"
ON "EventRegistration"("eventId", "clubId");
