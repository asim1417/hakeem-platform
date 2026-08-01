import "server-only";

// ضمان مخطط مواءمة المخطط السيادي وقت الإقلاع (idempotent) — يزيل خطر ترتيب الهجرة.
// كل عبارة إضافيّة بحتة (IF NOT EXISTS / DEFAULT يحفظ السلوك القائم)، فلا كسر مهما تكرّرت
// أو سبقت/تأخّرت عن نشر الكود. نفس نمط ensureConversationSessionSchema القائم.

import { prisma } from "@/lib/prisma";

const STATEMENTS: string[] = [
  // ① مغلّف الحدث (§6) — audit_logs
  `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "correlation_id" TEXT`,
  `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "causation_id" TEXT`,
  `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "schema_version" TEXT`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_correlation_id_idx" ON "audit_logs" ("correlation_id")`,

  // ② دورة حياة العلاقة (§8)
  `DO $$ BEGIN CREATE TYPE "RelationStatus" AS ENUM ('PROPOSED','VERIFIED','REJECTED','SUPERSEDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "status" "RelationStatus" NOT NULL DEFAULT 'VERIFIED'`,
  `ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "authority" DOUBLE PRECISION`,
  `ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "evidence_id" TEXT`,
  `CREATE INDEX IF NOT EXISTS "legal_relations_status_idx" ON "legal_relations" ("status")`,
  `ALTER TABLE "legal_graph_edges" ADD COLUMN IF NOT EXISTS "status" "RelationStatus" NOT NULL DEFAULT 'VERIFIED'`,

  // ③ تصنيف البيانات (§21)
  `DO $$ BEGIN CREATE TYPE "DataClass" AS ENUM ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "data_class" "DataClass"`,
  `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "data_class" "DataClass"`,
  `ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "data_class" "DataClass"`,
  `ALTER TABLE "judicial_work_cases" ADD COLUMN IF NOT EXISTS "data_class" "DataClass"`,

  // ④ جداول مركز المراجعة (§12)
  `DO $$ BEGIN CREATE TYPE "ReviewSessionStatus" AS ENUM ('OPEN','COMPLETED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "FindingSeverity" AS ENUM ('INFO','LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "SuggestionStatus" AS ENUM ('SUGGESTED','ACCEPTED','REJECTED','DEFERRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "review_sessions" (
    "id" TEXT PRIMARY KEY,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "status" "ReviewSessionStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "review_sessions_owner_id_created_at_idx" ON "review_sessions" ("owner_id","created_at")`,
  `CREATE INDEX IF NOT EXISTS "review_sessions_status_idx" ON "review_sessions" ("status")`,
  `CREATE TABLE IF NOT EXISTS "review_findings" (
    "id" TEXT PRIMARY KEY,
    "session_id" TEXT NOT NULL REFERENCES "review_sessions"("id") ON DELETE CASCADE,
    "category" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION,
    "affected_location" JSONB,
    "rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "review_findings_session_id_idx" ON "review_findings" ("session_id")`,
  `CREATE TABLE IF NOT EXISTS "review_suggestions" (
    "id" TEXT PRIMARY KEY,
    "session_id" TEXT NOT NULL REFERENCES "review_sessions"("id") ON DELETE CASCADE,
    "finding_id" TEXT REFERENCES "review_findings"("id") ON DELETE SET NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "review_suggestions_session_id_status_idx" ON "review_suggestions" ("session_id","status")`,
  `CREATE TABLE IF NOT EXISTS "review_reports" (
    "id" TEXT PRIMARY KEY,
    "session_id" TEXT NOT NULL UNIQUE REFERENCES "review_sessions"("id") ON DELETE CASCADE,
    "summary" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

/** يطبّق العبارات الإضافيّة تباعًا؛ دفاعيّ لكل عبارة فلا يوقف الإقلاع. */
export async function ensureBlueprintSchema(): Promise<boolean> {
  let ok = true;
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      ok = false;
      console.warn("[blueprint.schema] تخطّي عبارة:", (e as Error)?.message?.split("\n")[0]);
    }
  }
  return ok;
}
