CREATE TABLE "Certificate" (
    "id"        TEXT NOT NULL,
    "imageUrl"  TEXT NOT NULL,
    "title"     TEXT NOT NULL DEFAULT '',
    "order"     INTEGER NOT NULL DEFAULT 0,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Certificate_active_order_idx" ON "Certificate"("active", "order");
