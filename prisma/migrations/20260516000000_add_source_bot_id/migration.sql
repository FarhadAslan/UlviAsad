-- Quiz cədvəlinə sourceBotId sahəsi əlavə et
-- Bu sahə hansı AI botla yaradıldığını izləmək üçün istifadə olunur
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "sourceBotId" TEXT;

-- Index əlavə et
CREATE INDEX IF NOT EXISTS "Quiz_sourceBotId_idx" ON "Quiz"("sourceBotId");
