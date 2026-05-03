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

-- Mövcud default kateqoriyaları əlavə et (sabit id-lər istifadə edilir)
INSERT INTO "Category" ("id", "value", "label", "order", "createdAt") VALUES
  ('cat_qanunvericilik', 'QANUNVERICILIK', 'Qanunvericilik', 1, NOW()),
  ('cat_mantiq',         'MANTIQ',         'Məntiq',         2, NOW()),
  ('cat_azerbaycan',     'AZERBAYCAN_DILI','Azərbaycan Dili',3, NOW()),
  ('cat_informatika',    'INFORMATIKA',    'İnformatika',    4, NOW()),
  ('cat_dq_qebul',       'DQ_QEBUL',       'DQ Qəbul',       5, NOW())
ON CONFLICT ("value") DO NOTHING;
