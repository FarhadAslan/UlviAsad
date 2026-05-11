-- CreateTable: AiBot
CREATE TABLE "AiBot" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category"    TEXT NOT NULL DEFAULT '',
    "content"     TEXT NOT NULL,
    "prompt"      TEXT NOT NULL,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiBot_active_idx" ON "AiBot"("active");
CREATE INDEX "AiBot_category_idx" ON "AiBot"("category");
