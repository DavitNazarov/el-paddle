CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleItem_one_active_match_per_court"
ON "ScheduleItem" ("courtId")
WHERE "status" = 'IN_PROGRESS';

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleItem_one_active_match_per_judge"
ON "ScheduleItem" ("assignedJudgeId")
WHERE "assignedJudgeId" IS NOT NULL AND "status" = 'IN_PROGRESS';
