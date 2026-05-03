-- AlterTable: User modelinə teacherId əlavə et
ALTER TABLE "User" ADD COLUMN "teacherId" TEXT;

-- AlterTable: Quiz modelinə createdById əlavə et
ALTER TABLE "Quiz" ADD COLUMN "createdById" TEXT;

-- AddForeignKey: User.teacherId → User.id
ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Quiz.createdById → User.id
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_teacherId_idx" ON "User"("teacherId");

-- CreateIndex
CREATE INDEX "Quiz_createdById_idx" ON "Quiz"("createdById");
