-- AlterTable: AiBot-a createdById sahəsi əlavə et
ALTER TABLE "AiBot" ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "AiBot" ADD CONSTRAINT "AiBot_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AiBot_createdById_idx" ON "AiBot"("createdById");
