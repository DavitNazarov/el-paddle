-- AlterTable
ALTER TABLE "Event" ADD COLUMN "participationFee" INTEGER;

-- Backfill existing events with the previous marketing default (300 GEL).
UPDATE "Event" SET "participationFee" = 300 WHERE "participationFee" IS NULL;

-- Make required
ALTER TABLE "Event" ALTER COLUMN "participationFee" SET NOT NULL;
