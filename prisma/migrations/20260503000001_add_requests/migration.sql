-- CreateTable: Request modeli
CREATE TABLE "Request" (
    "id"             TEXT NOT NULL,
    "teacherId"      TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "message"        TEXT NOT NULL,
    "type"           TEXT NOT NULL DEFAULT 'GENERAL',
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote"      TEXT,
    "relatedQuizId"  TEXT,
    "relatedUserId"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Request_teacherId_idx" ON "Request"("teacherId");
CREATE INDEX "Request_status_idx"    ON "Request"("status");
