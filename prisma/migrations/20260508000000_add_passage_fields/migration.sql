-- AlterTable: Quiz modelinə passage sahələri əlavə edilir (METN tipi üçün)
ALTER TABLE "Quiz" ADD COLUMN "passageTitle"    TEXT;
ALTER TABLE "Quiz" ADD COLUMN "passageContent"  TEXT;
ALTER TABLE "Quiz" ADD COLUMN "passageImageUrl" TEXT;
