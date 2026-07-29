-- Reopening a completed slot match notifies the four affected players. PostgreSQL refuses to use
-- a new enum value in the transaction that adds it, so this lands in its own migration.
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_REOPENED';
