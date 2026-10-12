-- A club can be deleted while its teams are still playing out an event. That
-- nulls EventRegistration.clubId (ON DELETE SET NULL), so the identity frozen
-- onto a match has no club to name. Refusing to write the snapshot stopped the
-- event; recording "no club" is the honest answer and keeps the draw moving.
--
-- Widening only: every existing row keeps its club.
ALTER TABLE "MatchParticipantSnapshot" ALTER COLUMN "clubId" DROP NOT NULL;
ALTER TABLE "MatchParticipantSnapshot" ALTER COLUMN "clubName" DROP NOT NULL;
