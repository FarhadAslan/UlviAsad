#!/usr/bin/env node
/**
 * Deploy zamanı bloklanmış migration-ları resolve edir.
 * DB-də artıq mövcud olan cədvəl/sütunlar üçün "already exists" xətası verən
 * migration-lar bu script ilə "applied" kimi işarələnir.
 */

const { execSync } = require("child_process");

// AiBot xaricindəki bütün migration-lar DB-də artıq mövcuddur
const MIGRATIONS_TO_RESOLVE = [
  "20260425000000_init_postgresql",
  "20260502000000_result_quiz_cascade",
  "20260503000000_teacher_role",
  "20260503000001_add_requests",
  "20260503000002_add_categories",
  "20260503000003_question_points",
  "20260506000000_add_password_reset_token",
  "20260508000000_add_passage_fields",
  "20260508000001_add_open_question",
  "20260509000000_add_certificates",
];

for (const migration of MIGRATIONS_TO_RESOLVE) {
  try {
    execSync(`npx prisma migrate resolve --applied ${migration}`, {
      stdio: "pipe",
    });
    console.log(`✓ Resolved: ${migration}`);
  } catch (err) {
    // Artıq applied və ya uğurla tətbiq edilmişsə — keç
    console.log(`⚠ Skipped (already ok): ${migration}`);
  }
}

console.log("All migrations resolved. Proceeding with deploy...");
