-- Prevent the same player from appearing twice in one event
-- (once as owner and once as teammate) under concurrent inserts.
CREATE OR REPLACE FUNCTION prevent_event_registration_player_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EventRegistration" er
    WHERE er."eventId" = NEW."eventId"
      AND er.id IS DISTINCT FROM NEW.id
      AND (
        er."ownerId" = NEW."teammateId"
        OR er."teammateId" = NEW."ownerId"
        OR er."ownerId" = NEW."ownerId"
        OR er."teammateId" = NEW."teammateId"
      )
  ) THEN
    RAISE EXCEPTION 'Player already registered for this event'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_registration_player_overlap ON "EventRegistration";

CREATE TRIGGER event_registration_player_overlap
BEFORE INSERT OR UPDATE OF "eventId", "ownerId", "teammateId"
ON "EventRegistration"
FOR EACH ROW
EXECUTE FUNCTION prevent_event_registration_player_overlap();
