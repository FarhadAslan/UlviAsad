-- Google OAuth üçün Account cədvəli (NextAuth PrismaAdapter)
CREATE TABLE IF NOT EXISTS "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- User.password optional et
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Foreign key
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");

-- Index
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
