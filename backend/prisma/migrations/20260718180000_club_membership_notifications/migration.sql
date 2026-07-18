-- Add club membership outcomes to the reliable notification and email queue.
ALTER TYPE "NotificationType" ADD VALUE 'CLUB_JOIN_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CLUB_JOIN_REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CLUB_MEMBERSHIP_REMOVED';
