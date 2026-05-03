-- CreateTable: Category modeli
CREATE TABLE "Category" (
    "id"        TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_value_key" ON "Category"("value");

-- Mövcud default kateqoriyaları əlavə et
INSERT INTO "Category" ("id", "value", "label", "order", "createdAt") VALUES
  (gen_random_uuid()::text, 'QANUNVERICILIK', 'Qanunvericilik', 1, NOW()),
  (gen_random_uuid()::text, 'MANTIQ',         'Məntiq',         2, NOW()),
  (gen_random_uuid()::text, 'AZERBAYCAN_DILI','Azərbaycan Dili',3, NOW()),
  (gen_random_uuid()::text, 'INFORMATIKA',    'İnformatika',    4, NOW()),
  (gen_random_uuid()::text, 'DQ_QEBUL',       'DQ Qəbul',       5, NOW());
