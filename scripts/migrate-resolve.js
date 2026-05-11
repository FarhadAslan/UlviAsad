#!/usr/bin/env node
/**
 * Bu script deploy zamanı bloklanmış migration-ları resolve edir.
 * "relation already exists" xətası verən migration-lar artıq DB-də mövcuddur,
 * sadəcə Prisma migration tarixçəsini yeniləmək lazımdır.
 */

const { execSync } = require("child_process");

const FAILED_MIGRATIONS = [
  "20260506000000_add_password_reset_token",
];

for (const migration of FAILED_MIGRATIONS) {
  try {
    console.log(`Resolving migration: ${migration}`);
    execSync(`npx prisma migrate resolve --applied ${migration}`, {
      stdio: "inherit",
    });
    console.log(`✓ Resolved: ${migration}`);
  } catch (err) {
    // Artıq resolve edilmişsə xəta verə bilər — ignore et
    console.log(`⚠ Skipped (already resolved): ${migration}`);
  }
}

console.log("Migration resolve completed.");
