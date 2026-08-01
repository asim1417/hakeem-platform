// ─────────────────────────────────────────────────────────────────────────────
// §21 — نموذج بيانات JDS المطبَّع (هجرةٌ ذاتيّة idempotent، لا هجرات build)
//
// تتبع سابقة `judicial-assistant/schema-ensure.ts`: جُمَل IF NOT EXISTS، memoized،
// سقوطٌ آمن (إن فشلت تُعاد لاحقًا دون كسر الطلب). كلّ جدولٍ يحمل أعمدة التتبّع (§21):
// scoping + law_as_of_date + versions + content_hash + created/reviewed/approved.
// تُشغَّل جميع خدمات القضاء فوق هذه الجداول (لا مكدّس ثالث).
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

// أعمدة التتبّع المشتركة (§21) — تُلحق بكلّ جدولٍ منتِج.
const TRACE_COLUMNS = `
    "owner_id"        TEXT,
    "case_id"         UUID,
    "workspace_id"    UUID,
    "jurisdiction"    TEXT,
    "court_track"     TEXT,
    "litigation_stage" TEXT,
    "law_as_of_date"  TEXT,
    "role_profile"    TEXT,
    "domain_pack_version" TEXT,
    "pattern_set_version" TEXT,
    "content_hash"    TEXT,
    "created_by"      TEXT,
    "reviewed_by"     TEXT,
    "approved_by"     TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

export const JDS_DDL: readonly string[] = [
  // ── حزم المجال المُثبَّتة (§8) — تُبذَر من السجلّ، ويُحقن law_as_of_date الحقيقيّ في PR3 ──
  `CREATE TABLE IF NOT EXISTS "jds_domain_packs" (
    "id"             TEXT PRIMARY KEY,
    "title_ar"       TEXT NOT NULL,
    "court_track"    TEXT NOT NULL,
    "version"        TEXT NOT NULL,
    "law_as_of_date" TEXT NOT NULL DEFAULT 'PENDING',
    "stages"         JSONB NOT NULL DEFAULT '[]',
    "playbook_categories" JSONB NOT NULL DEFAULT '[]',
    "prohibited_transfer_from" JSONB NOT NULL DEFAULT '[]',
    "notes_ar"       TEXT,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ── لقطات السلطة الرسميّة (§7/§6.1) — تُثبت سريان النصّ وقت الاستناد ──
  `CREATE TABLE IF NOT EXISTS "jds_authority_snapshots" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "source_layer"   TEXT NOT NULL,
    "system_name"    TEXT,
    "article_id"     UUID,
    "article_number" TEXT,
    "text_excerpt"   TEXT,
    "effective_from" TEXT,
    "law_as_of_date" TEXT NOT NULL,
    "currentness"    TEXT NOT NULL DEFAULT 'unverified',
    "source_url"     TEXT,
    "verified_at"    TIMESTAMPTZ,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_authority_snapshots_article_idx" ON "jds_authority_snapshots"("article_id")`,

  // ── خريطة الإجراءات (§12) ──
  `CREATE TABLE IF NOT EXISTS "jds_procedure_graphs" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "domain_pack"     TEXT NOT NULL,
    "validation_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "unresolved_requirements" JSONB NOT NULL DEFAULT '[]',${TRACE_COLUMNS}
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_procedure_graphs_case_idx" ON "jds_procedure_graphs"("case_id")`,
  `CREATE TABLE IF NOT EXISTS "jds_procedure_nodes" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "graph_id"    UUID NOT NULL,
    "type"        TEXT NOT NULL,
    "title_ar"    TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "required_facts"      JSONB NOT NULL DEFAULT '[]',
    "required_documents"  JSONB NOT NULL DEFAULT '[]',
    "required_authorities" JSONB NOT NULL DEFAULT '[]',
    "completion_criteria" JSONB NOT NULL DEFAULT '[]',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_procedure_nodes_graph_idx" ON "jds_procedure_nodes"("graph_id")`,
  `CREATE TABLE IF NOT EXISTS "jds_procedure_edges" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "graph_id"    UUID NOT NULL,
    "from_node"   TEXT NOT NULL,
    "to_node"     TEXT NOT NULL,
    "condition"   TEXT NOT NULL DEFAULT '',
    "authority_snapshot_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_procedure_edges_graph_idx" ON "jds_procedure_edges"("graph_id")`,

  // ── وصفة المستند (§16) ──
  `CREATE TABLE IF NOT EXISTS "jds_document_recipes" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "task_id"         TEXT NOT NULL,
    "version"         TEXT NOT NULL DEFAULT '0.1.0',
    "output_type"     TEXT NOT NULL,
    "procedure_graph_id" UUID,
    "source_style_signatures" JSONB NOT NULL DEFAULT '[]',
    "mandatory_procedural_checks" JSONB NOT NULL DEFAULT '[]',
    "applied_pattern_ids" JSONB NOT NULL DEFAULT '[]',
    "applied_authority_snapshot_ids" JSONB NOT NULL DEFAULT '[]',
    "validation_status" TEXT NOT NULL DEFAULT 'DRAFT',${TRACE_COLUMNS}
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_document_recipes_task_idx" ON "jds_document_recipes"("task_id")`,
  `CREATE TABLE IF NOT EXISTS "jds_recipe_sections" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "recipe_id"   UUID NOT NULL,
    "ord"         INT NOT NULL,
    "key"         TEXT NOT NULL,
    "title_ar"    TEXT NOT NULL,
    "judicial_function" TEXT NOT NULL,
    "inclusion_reason"  TEXT,
    "required_facts"      JSONB NOT NULL DEFAULT '[]',
    "required_evidence"   JSONB NOT NULL DEFAULT '[]',
    "required_authorities" JSONB NOT NULL DEFAULT '[]',
    "allowed_pattern_ids"  JSONB NOT NULL DEFAULT '[]',
    "prohibited_pattern_ids" JSONB NOT NULL DEFAULT '[]',
    "completion_criteria"  JSONB NOT NULL DEFAULT '[]',
    "quality_gate_ids"     JSONB NOT NULL DEFAULT '[]',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_recipe_sections_recipe_idx" ON "jds_recipe_sections"("recipe_id")`,

  // ── تتبّع العبارة (§22) ──
  `CREATE TABLE IF NOT EXISTS "jds_statement_traces" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "draft_version_id" UUID NOT NULL,
    "section_id"      UUID,
    "start_offset"    INT NOT NULL DEFAULT 0,
    "end_offset"      INT NOT NULL DEFAULT 0,
    "statement_type"  TEXT NOT NULL,
    "assertion_level" TEXT NOT NULL DEFAULT 'ASSERTED',
    "fact_ids"        JSONB NOT NULL DEFAULT '[]',
    "evidence_ids"    JSONB NOT NULL DEFAULT '[]',
    "authority_snapshot_ids" JSONB NOT NULL DEFAULT '[]',
    "drafting_pattern_ids"  JSONB NOT NULL DEFAULT '[]',
    "procedure_node_ids"    JSONB NOT NULL DEFAULT '[]',
    "verification_status"   TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_statement_traces_draft_idx" ON "jds_statement_traces"("draft_version_id")`,

  // ── نتائج بوّابات الجودة (§27) ──
  `CREATE TABLE IF NOT EXISTS "jds_quality_findings" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "draft_version_id" UUID,
    "task_id"     TEXT,
    "gate_id"     TEXT NOT NULL,
    "outcome"     TEXT NOT NULL,
    "severity"    TEXT NOT NULL DEFAULT 'BLOCKING',
    "findings"    JSONB NOT NULL DEFAULT '[]',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "jds_quality_findings_task_idx" ON "jds_quality_findings"("task_id")`,
];

let ready: Promise<boolean> | null = null;

/** يضمن وجود جداول JDS. memoized لكلّ نسخة خادم؛ يُصفَّر عند الفشل ليُعاد. سقوطٌ آمن. */
export async function ensureJudicialCoreSchema(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const sql of JDS_DDL) await prisma.$executeRawUnsafe(sql);
        return true;
      } catch {
        ready = null;
        return false;
      }
    })();
  }
  return ready;
}

/** أسماء جداول JDS (للفحص والتدقيق). */
export const JDS_TABLES: readonly string[] = [
  "jds_domain_packs",
  "jds_authority_snapshots",
  "jds_procedure_graphs",
  "jds_procedure_nodes",
  "jds_procedure_edges",
  "jds_document_recipes",
  "jds_recipe_sections",
  "jds_statement_traces",
  "jds_quality_findings",
];
