-- AlterTable: Question modelinə açıq sual sahələri əlavə edilir
ALTER TABLE "Question" ADD COLUMN "questionType"      TEXT NOT NULL DEFAULT 'CHOICE';
ALTER TABLE "Question" ADD COLUMN "openAnswerExample" TEXT;
