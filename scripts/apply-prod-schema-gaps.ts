/**
 * تطبيق فجوات مخطط الإنتاج — idempotent، إضافية فقط.
 * تشغيل: DATABASE_URL=… npx tsx scripts/apply-prod-schema-gaps.ts
 * لا يحذف بيانات. لا يستخدم prisma db push.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function exec(label: string, sql: string) {
  process.stdout.write(`→ ${label} … `);
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // تجاهل «موجود أصلًا» إن وُجدت بصيغ مختلفة
    if (/already exists|duplicate_object|42710|42P07/i.test(msg)) {
      console.log("skip (exists)");
      return;
    }
    console.log("FAIL");
    throw new Error(`${label}: ${msg}`);
  }
}

async function execFile(label: string, rel: string) {
  const full = path.join(process.cwd(), rel);
  const sql = fs.readFileSync(full, "utf8");
  // قسّم على ; مع تجاهل التعليقات الفارغة — نفّذ جملة جملة (مهم لـ ADD VALUE)
  const parts = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.split("\n").every((l) => l.trim().startsWith("--") || !l.trim()));
  console.log(`\n=== ${label} (${parts.length} statements) ===`);
  for (let i = 0; i < parts.length; i++) {
    const stmt = parts[i].endsWith(";") ? parts[i] : parts[i] + ";";
    // تخطّي كتل DO $$ … $$ كاملة كجملة واحدة إن وُجدت
    await exec(`${label}#${i + 1}`, stmt);
  }
}

async function main() {
  const [{ db }] = (await prisma.$queryRawUnsafe(`SELECT current_database() AS db`)) as { db: string }[];
  console.log(`connected: ${db}`);

  // ── المرحلة 1: أدوار ──
  console.log("\n=== Phase 1: UserRole enums ===");
  await exec("SUPER_ADMIN", `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'`);
  await exec("JUDGE", `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JUDGE'`);

  // ── المرحلة 2: مستخدمون + نقاط ──
  await execFile("Phase 2a onboarding/credits", "prisma/migrations/20260718180000_onboarding_credits_referrals/migration.sql");
  await execFile("Phase 2b otp/avatar", "prisma/migrations/20260718190000_otp_avatar_profile_ext/migration.sql");

  // أعمدة referral من usage_credits_v2 (الجزء الخاص بـ referral_redemptions فقط)
  console.log("\n=== Phase 2c referral_redemptions extras ===");
  for (const [label, sql] of [
    ["status", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending'`],
    ["verifiedAt", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ`],
    ["profileCompletedAt", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMPTZ`],
    ["firstUseAt", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "firstUseAt" TIMESTAMPTZ`],
    ["qualifiedAt", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMPTZ`],
    ["firstPurchaseAt", `ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "firstPurchaseAt" TIMESTAMPTZ`],
  ] as const) {
    await exec(label, sql);
  }

  // ── المرحلة 3: مرفقات ──
  // ملف الهجرة فيه DO $$ … $$؛ نفّذه ككتلة واحدة عبر تقسيم حذر
  console.log("\n=== Phase 3: attachments ===");
  const attSql = fs.readFileSync(
    "prisma/migrations/20260728120000_attachment_processing_metadata_pr1/migration.sql",
    "utf8"
  );
  // استخرج كتل DO واستعلامات ALTER
  const doBlocks = [...attSql.matchAll(/DO \$\$[\s\S]*?END \$\$;/g)].map((m) => m[0]);
  for (let i = 0; i < doBlocks.length; i++) {
    await exec(`enum-block#${i + 1}`, doBlocks[i]);
  }
  const alterMatch = attSql.match(/ALTER TABLE "attachments"[\s\S]*?CURRENT_TIMESTAMP;/);
  if (alterMatch) await exec("attachments columns", alterMatch[0]);

  // ── المرحلة 4: annotations + folders ──
  console.log("\n=== Phase 4: annotations + folders ===");
  await exec(
    "annotations",
    `CREATE TABLE IF NOT EXISTS "annotations" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "case_id" TEXT,
      "document_type" TEXT NOT NULL,
      "document_id" TEXT NOT NULL,
      "highlighted_text" TEXT,
      "note" TEXT,
      "color" TEXT NOT NULL DEFAULT '#FEF08A',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(`annotations_user_idx`, `CREATE INDEX IF NOT EXISTS "annotations_user_id_idx" ON "annotations"("user_id")`);
  await exec(
    `annotations_doc_idx`,
    `CREATE INDEX IF NOT EXISTS "annotations_document_type_document_id_idx" ON "annotations"("document_type", "document_id")`
  );
  // FK — فقط إن لم توجد
  await exec(
    "annotations_user_fk",
    `DO $$ BEGIN
      ALTER TABLE "annotations" ADD CONSTRAINT "annotations_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );
  await exec(
    "annotations_case_fk",
    `DO $$ BEGIN
      ALTER TABLE "annotations" ADD CONSTRAINT "annotations_case_id_fkey"
        FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
              WHEN undefined_table THEN NULL; END $$`
  );

  await exec(
    "folders",
    `CREATE TABLE IF NOT EXISTS "folders" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "parent_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(`folders_user_idx`, `CREATE INDEX IF NOT EXISTS "folders_user_id_idx" ON "folders"("user_id")`);
  await exec(
    "folders_user_fk",
    `DO $$ BEGIN
      ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );
  await exec(
    "folders_parent_fk",
    `DO $$ BEGIN
      ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  // ── المرحلة 5: محاكاة + rate limit + جداول بلا ترحيل ──
  console.log("\n=== Phase 5a: simulation ===");
  const simSql = fs.readFileSync(
    "prisma/migrations/20260625130000_add_legal_chat_workspace/migration.sql",
    "utf8"
  );
  // نفّذ فقط ما يخص simulation_cases / simulation_runs إن أمكن — الملف قد يعتمد على جداول أخرى
  // إنشاء الجداول الأساسية idempotent:
  await exec(
    "simulation_cases",
    `CREATE TABLE IF NOT EXISTS "simulation_cases" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "user_role" TEXT,
      "dispute_type" TEXT,
      "track_type" TEXT,
      "procedural_stage" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "summary" TEXT,
      "claim_value" TEXT,
      "has_arbitration_clause" BOOLEAN,
      "facts" JSONB,
      "parties" JSONB,
      "evidence" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "simulation_cases_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(
    "simulation_cases_user_idx",
    `CREATE INDEX IF NOT EXISTS "simulation_cases_user_id_idx" ON "simulation_cases"("user_id")`
  );
  await exec(
    "simulation_cases_user_fk",
    `DO $$ BEGIN
      ALTER TABLE "simulation_cases" ADD CONSTRAINT "simulation_cases_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  await exec(
    "simulation_runs",
    `CREATE TABLE IF NOT EXISTS "simulation_runs" (
      "id" TEXT NOT NULL,
      "case_id" TEXT,
      "user_id" TEXT,
      "mode" TEXT NOT NULL,
      "output_type" TEXT,
      "input_snapshot" JSONB,
      "understood_request" JSONB,
      "user_approval_status" TEXT NOT NULL DEFAULT 'PENDING',
      "retrieved_articles" JSONB,
      "output" TEXT,
      "warnings" JSONB,
      "confidence" DOUBLE PRECISION,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(
    "simulation_runs_case_idx",
    `CREATE INDEX IF NOT EXISTS "simulation_runs_case_id_idx" ON "simulation_runs"("case_id")`
  );
  await exec(
    "simulation_runs_case_fk",
    `DO $$ BEGIN
      ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_case_id_fkey"
        FOREIGN KEY ("case_id") REFERENCES "simulation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  console.log("\n=== Phase 5b: generic_rate_limit_windows ===");
  await exec(
    "generic_rate_limit_windows",
    `CREATE TABLE IF NOT EXISTS generic_rate_limit_windows (
      id TEXT PRIMARY KEY,
      bucket_key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await exec(
    "grlw_uidx",
    `CREATE UNIQUE INDEX IF NOT EXISTS generic_rate_limit_windows_bucket_window_uidx
      ON generic_rate_limit_windows (bucket_key, window_start)`
  );
  await exec(
    "grlw_idx",
    `CREATE INDEX IF NOT EXISTS generic_rate_limit_windows_window_idx
      ON generic_rate_limit_windows (window_start)`
  );

  console.log("\n=== Phase 5c: bug_reports / legal_topics / search_logs ===");
  await exec(
    "bug_reports",
    `CREATE TABLE IF NOT EXISTS "bug_reports" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "suggestedFix" TEXT,
      "caseId" TEXT,
      "subject" TEXT,
      "stage" TEXT,
      "context" JSONB,
      "actorId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(`bug_reports_type_idx`, `CREATE INDEX IF NOT EXISTS "bug_reports_type_idx" ON "bug_reports"("type")`);
  await exec(
    `bug_reports_created_idx`,
    `CREATE INDEX IF NOT EXISTS "bug_reports_createdAt_idx" ON "bug_reports"("createdAt")`
  );

  await exec(
    "legal_topics",
    `CREATE TABLE IF NOT EXISTS "legal_topics" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "parent_id" TEXT,
      "path" TEXT NOT NULL DEFAULT '',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "legal_topics_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(
    "legal_topics_name_key",
    `CREATE UNIQUE INDEX IF NOT EXISTS "legal_topics_name_key" ON "legal_topics"("name")`
  );
  await exec(
    "legal_topics_parent_idx",
    `CREATE INDEX IF NOT EXISTS "legal_topics_parent_id_idx" ON "legal_topics"("parent_id")`
  );
  await exec(
    "legal_topics_path_idx",
    `CREATE INDEX IF NOT EXISTS "legal_topics_path_idx" ON "legal_topics"("path")`
  );
  await exec(
    "legal_topics_parent_fk",
    `DO $$ BEGIN
      ALTER TABLE "legal_topics" ADD CONSTRAINT "legal_topics_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "legal_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  await exec(
    "search_logs",
    `CREATE TABLE IF NOT EXISTS "search_logs" (
      "id" TEXT NOT NULL,
      "user_id" TEXT,
      "query" TEXT NOT NULL,
      "filters" JSONB,
      "results_count" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
    )`
  );
  await exec(
    "search_logs_created_idx",
    `CREATE INDEX IF NOT EXISTS "search_logs_created_at_idx" ON "search_logs"("created_at")`
  );
  await exec(
    "search_logs_user_idx",
    `CREATE INDEX IF NOT EXISTS "search_logs_user_id_idx" ON "search_logs"("user_id")`
  );

  // ── تحقق سريع ──
  console.log("\n=== Verify ===");
  const roles = (await prisma.$queryRawUnsafe(
    `SELECT unnest(enum_range(NULL::"UserRole"))::text AS role`
  )) as { role: string }[];
  const missingTables = (await prisma.$queryRawUnsafe(`
    SELECT t AS missing FROM (VALUES
      ('annotations'),('bug_reports'),('credit_transactions'),('folders'),
      ('generic_rate_limit_windows'),('legal_topics'),('referral_redemptions'),
      ('search_logs'),('simulation_cases'),('simulation_runs')
    ) v(t)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=v.t
    )
  `)) as { missing: string }[];
  const missingUserCols = (await prisma.$queryRawUnsafe(`
    SELECT c AS missing FROM (VALUES
      ('phone'),('creditsBalance'),('onboardingCompleted'),('referralCode'),
      ('lastDailyVisit'),('entityType'),('avatarUrl')
    ) v(c)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name=v.c
    )
  `)) as { missing: string }[];
  console.log(
    JSON.stringify(
      {
        roles: roles.map((r) => r.role),
        missingTables: missingTables.map((m) => m.missing),
        missingUserCols: missingUserCols.map((m) => m.missing),
        hasSuperAdmin: roles.some((r) => r.role === "SUPER_ADMIN"),
        hasJudge: roles.some((r) => r.role === "JUDGE"),
      },
      null,
      2
    )
  );

  void simSql; // الملف محفوظ للمراجعة؛ أنشأنا الجداول idempotent أعلاه
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
