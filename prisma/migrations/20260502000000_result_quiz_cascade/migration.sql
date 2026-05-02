-- AlterTable: Result.quizId foreign key ON DELETE RESTRICT -> CASCADE
-- This allows Quiz deletion to automatically remove associated Results

ALTER TABLE "Result" DROP CONSTRAINT "Result_quizId_fkey";

ALTER TABLE "Result" ADD CONSTRAINT "Result_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
