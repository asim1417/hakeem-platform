-- الرسم القانوني رباعي الطبقات (حزمة hakeem-bylaw-linking):
--   legal_graph_nodes  — عُقد: مادة نظام/لائحة/ضابط/دليل.
--   legal_graph_edges  — علاقات مُوسومة (IMPLEMENTS/GOVERNED_BY/…)، ثقة + مصدر (بنيوي/صريح).
-- إضافة فقط، آمن لإعادة التشغيل (idempotent). لا حذف.
-- Rollback:
--   DROP TABLE IF EXISTS "legal_graph_edges";
--   DROP TABLE IF EXISTS "legal_graph_nodes";
--   DROP TYPE  IF EXISTS "RelationSource";
--   DROP TYPE  IF EXISTS "LegalRelationType";
--   DROP TYPE  IF EXISTS "LegalNodeType";

-- ── Enums (CREATE TYPE لا يدعم IF NOT EXISTS؛ نحرسه بـ DO) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LegalNodeType') THEN
    CREATE TYPE "LegalNodeType" AS ENUM ('SYSTEM_ARTICLE', 'BYLAW_ARTICLE', 'CONTROL', 'PROCEDURE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LegalRelationType') THEN
    CREATE TYPE "LegalRelationType" AS ENUM ('IMPLEMENTS', 'GOVERNED_BY', 'PROCEDURE_FOR', 'REFERS', 'DETAILS', 'AMENDS');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RelationSource') THEN
    CREATE TYPE "RelationSource" AS ENUM ('STRUCTURAL', 'EXPLICIT', 'MANUAL');
  END IF;
END $$;

-- ── Tables ──
CREATE TABLE IF NOT EXISTS "legal_graph_nodes" (
    "id" TEXT NOT NULL,
    "type" "LegalNodeType" NOT NULL,
    "law" TEXT NOT NULL,
    "number" INTEGER,
    "seq" INTEGER,
    "body" TEXT,
    "sourceUrl" TEXT,
    "articleId" TEXT,
    CONSTRAINT "legal_graph_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "legal_graph_edges" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "LegalRelationType" NOT NULL DEFAULT 'IMPLEMENTS',
    "evidence" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "source" "RelationSource" NOT NULL DEFAULT 'STRUCTURAL',
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legal_graph_edges_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS "legal_graph_nodes_type_idx" ON "legal_graph_nodes"("type");
CREATE INDEX IF NOT EXISTS "legal_graph_nodes_law_number_idx" ON "legal_graph_nodes"("law", "number");
CREATE INDEX IF NOT EXISTS "legal_graph_nodes_articleId_idx" ON "legal_graph_nodes"("articleId");
CREATE INDEX IF NOT EXISTS "legal_graph_edges_targetId_idx" ON "legal_graph_edges"("targetId");
CREATE INDEX IF NOT EXISTS "legal_graph_edges_sourceId_idx" ON "legal_graph_edges"("sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_graph_edges_sourceId_targetId_type_key" ON "legal_graph_edges"("sourceId", "targetId", "type");

-- ── Foreign keys (محروسة بـ DO لتفادي التكرار) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_graph_nodes_articleId_fkey') THEN
    ALTER TABLE "legal_graph_nodes" ADD CONSTRAINT "legal_graph_nodes_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "legal_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_graph_edges_sourceId_fkey') THEN
    ALTER TABLE "legal_graph_edges" ADD CONSTRAINT "legal_graph_edges_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "legal_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_graph_edges_targetId_fkey') THEN
    ALTER TABLE "legal_graph_edges" ADD CONSTRAINT "legal_graph_edges_targetId_fkey"
      FOREIGN KEY ("targetId") REFERENCES "legal_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
