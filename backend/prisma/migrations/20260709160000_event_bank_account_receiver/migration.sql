-- AlterTable
ALTER TABLE "Event" ADD COLUMN "bankAccountReceiver" TEXT;

-- Backfill mock receiver name for existing events.
UPDATE "Event" SET "bankAccountReceiver" = 'El Padel Georgia' WHERE "bankAccountReceiver" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "bankAccountReceiver" SET NOT NULL;
