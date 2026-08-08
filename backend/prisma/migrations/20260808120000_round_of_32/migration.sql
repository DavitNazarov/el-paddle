-- A 32-entry draw needs a first round ahead of the round of 16. It is added
-- BEFORE that value so the enum's own sort order still reads as the order the
-- rounds are played, which is what any future ORDER BY on the column would use.
--
-- PostgreSQL refuses to use a new enum value in the transaction that adds it,
-- so this migration adds the value and nothing else.
ALTER TYPE "MatchRound" ADD VALUE IF NOT EXISTS 'ROUND_OF_32' BEFORE 'ROUND_OF_16';
