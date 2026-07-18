CREATE INDEX "User_role_status_name_surname_createdAt_id_idx"
  ON "User"("role", "status", "name", "surname", "createdAt", "id");

CREATE INDEX "Event_isPublished_date_id_idx"
  ON "Event"("isPublished", "date", "id");

CREATE INDEX "EventRegistration_eventId_status_createdAt_id_idx"
  ON "EventRegistration"("eventId", "status", "createdAt", "id");
CREATE INDEX "EventRegistration_ownerId_createdAt_id_idx"
  ON "EventRegistration"("ownerId", "createdAt", "id");
CREATE INDEX "EventRegistration_teammateId_createdAt_id_idx"
  ON "EventRegistration"("teammateId", "createdAt", "id");

CREATE INDEX "OpponentRequest_status_expiresAt_id_idx"
  ON "OpponentRequest"("status", "expiresAt", "id");

CREATE INDEX "Match_status_completedAt_id_idx"
  ON "Match"("status", "completedAt", "id");

CREATE INDEX "Notification_recipientUserId_createdAt_id_idx"
  ON "Notification"("recipientUserId", "createdAt", "id");

CREATE INDEX "OutboxMessage_status_availableAt_createdAt_id_idx"
  ON "OutboxMessage"("status", "availableAt", "createdAt", "id");
