-- Event lifecycle changes previously reused MATCH_SCHEDULED, which was misleading
-- for any per-type filtering/rendering. Give them a dedicated notification type.
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_STATUS_CHANGED';
