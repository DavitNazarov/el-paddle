-- Add an event-scoped publication control for the approved registration roster.
ALTER TABLE "Event"
ADD COLUMN "registrationRosterPublishedAt" TIMESTAMP(3);
