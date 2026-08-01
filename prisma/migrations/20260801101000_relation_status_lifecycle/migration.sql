-- دورة حياة العلاقة (المخطط السيادي §8) — إضافيّة، تحفظ سلوك القائم.
-- المستنتَج آليًّا يبدأ PROPOSED؛ السجلات القائمة تبقى VERIFIED افتراضًا.

DO $$ BEGIN
  CREATE TYPE "RelationStatus" AS ENUM ('PROPOSED','VERIFIED','REJECTED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "status" "RelationStatus" NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "authority" DOUBLE PRECISION;
ALTER TABLE "legal_relations" ADD COLUMN IF NOT EXISTS "evidence_id" TEXT;
CREATE INDEX IF NOT EXISTS "legal_relations_status_idx" ON "legal_relations" ("status");

ALTER TABLE "legal_graph_edges" ADD COLUMN IF NOT EXISTS "status" "RelationStatus" NOT NULL DEFAULT 'VERIFIED';
