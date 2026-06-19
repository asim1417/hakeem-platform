-- ════════════════════════════════════════════════════════════════════════
-- Legal Thesaurus — migration 002: حقول التكرار + نطاق الاستخراج + موقع المادة.
-- ALTER على جداول المكنز **الجديدة فقط** (لا مساس بـ legal_articles/legal_systems).
-- آمن للتكرار (ADD COLUMN IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════════

-- المفاهيم: نطاق الاستخراج + الموقع + إحصاءات التكرار
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "extraction_scope" TEXT;            -- definitions_only | full_body | mixed
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "source_position" TEXT;             -- early_articles | middle_articles | late_articles | all_system
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "article_position_ratio" DOUBLE PRECISION;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "total_occurrences_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "distinct_articles_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "distinct_sources_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "first_occurrence_article_id" TEXT;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "strongest_occurrence_article_id" TEXT;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "occurrence_distribution_json" JSONB;
ALTER TABLE "legal_thesaurus_concepts" ADD COLUMN IF NOT EXISTS "recurrence_strength" TEXT;          -- single_occurrence | repeated_in_same_article | repeated_in_same_system | repeated_across_systems | high_frequency_core_concept

-- مواضع الورود: حقول إضافية
ALTER TABLE "legal_thesaurus_occurrences" ADD COLUMN IF NOT EXISTS "legal_source_name" TEXT;
ALTER TABLE "legal_thesaurus_occurrences" ADD COLUMN IF NOT EXISTS "match_type" TEXT;                -- exact_label_match | synonym_match | variant_match | normalized_match | semantic_match_candidate
ALTER TABLE "legal_thesaurus_occurrences" ADD COLUMN IF NOT EXISTS "confidence_score" INTEGER;
ALTER TABLE "legal_thesaurus_occurrences" ADD COLUMN IF NOT EXISTS "article_position_ratio" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "idx_thes_concept_scope" ON "legal_thesaurus_concepts"("extraction_scope");
CREATE INDEX IF NOT EXISTS "idx_thes_concept_recurrence" ON "legal_thesaurus_concepts"("recurrence_strength");
