-- AlterTable
ALTER TABLE "Event" ADD COLUMN "bankAccountIban" TEXT;

-- Backfill mock Georgian IBAN for existing events.
UPDATE "Event" SET "bankAccountIban" = 'GE29NB0000000101904917' WHERE "bankAccountIban" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "bankAccountIban" SET NOT NULL;
