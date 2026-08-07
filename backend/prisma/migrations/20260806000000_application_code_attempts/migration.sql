-- Burn a verification code after repeated wrong guesses.
--
-- A six-digit code is a 900k space, which only means something if the number of
-- tries is bounded. Rate limiting bounds attempts per window; this bounds them
-- per code, so a code cannot be ground down across many windows.
--
-- Additive and defaulted, so existing rows need no backfill and the column is
-- safe to deploy ahead of the code that reads it.
ALTER TABLE "ClubApplicationCode" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
