-- توسعة المرحلة الأولى (CLAUDE.md): Knowledge Graph + pgvector
-- إضافية بالكامل: تفعيل امتداد vector + جداول legal_relations / embeddings / annotations / folders
-- لا تعدّل ولا تحذف أي جدول قائم. لا تُشغَّل تلقائياً على الإنتاج.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'INTERPRETS', 'IMPLEMENTS', 'SUPERSEDES', 'RELATED_TO');

-- CreateTable
CREATE TABLE "legal_relations" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation" "RelationType" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "embedding" vector(1536),
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
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
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_relations_source_type_source_id_idx" ON "legal_relations"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "legal_relations_target_type_target_id_idx" ON "legal_relations"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "legal_relations_relation_idx" ON "legal_relations"("relation");

-- CreateIndex
CREATE INDEX "embeddings_owner_type_owner_id_idx" ON "embeddings"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_owner_type_owner_id_key" ON "embeddings"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "annotations_user_id_idx" ON "annotations"("user_id");

-- CreateIndex
CREATE INDEX "annotations_document_type_document_id_idx" ON "annotations"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

