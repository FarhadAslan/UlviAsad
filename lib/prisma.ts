import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function buildUrl(base: string | undefined): string | undefined {
  if (!base) return undefined;
  // Serverless mühitdə connection_limit=1 vacibdir —
  // hər function invocation-ı üçün yalnız 1 connection açılır,
  // bu PgBouncer/Supabase pooler ilə uyğundur.
  if (base.includes("connection_limit")) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=1&pool_timeout=10`;
}

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === "production";

  // Production-da $transaction üçün birbaşa connection (DIRECT_URL) istifadə et.
  // PgBouncer "transaction mode"-da Prisma $transaction ilə uyğunsuzluq yaradır.
  // Development-də DATABASE_URL istifadə et.
  const url = isProduction
    ? (process.env.DIRECT_URL ?? process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

  const builtUrl = buildUrl(url);

  // Build zamanı env variable-lar mövcud olmaya bilər.
  // datasources yalnız url mövcud olduqda ötürülür,
  // əks halda Prisma schema-dakı env() oxuyur.
  return new PrismaClient({
    log: isProduction ? ["error"] : ["error", "warn"],
    ...(builtUrl ? { datasources: { db: { url: builtUrl } } } : {}),
  });
}

// Development-də hot-reload zamanı çoxlu connection açılmasının qarşısını al.
// Production serverless-də global cache işləmir — hər invocation yeni client yaradır,
// amma connection_limit=1 sayəsində pool overflow olmur.
export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
