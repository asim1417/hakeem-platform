-- ════════════════════════════════════════════════════════════════════════
-- Legal Thesaurus — schema (جداول جديدة فقط، لا مساس بالجداول الأصلية)
-- آمن للتكرار (IF NOT EXISTS). FKs منطقية إلى legal_articles/legal_systems
-- (ON DELETE SET NULL) بلا أي ALTER على الجداول الأصلية. يُطبَّق عبر workflow مُقفل.
--
-- القاعدة الحاكمة: لا مفهوم/مرادف/علاقة بلا سند نصّي (evidence) من مادة قائمة.
-- ════════════════════════════════════════════════════════════════════════

-- 1) سجلّ عمليات الاستخراج
CREATE TABLE IF NOT EXISTS "legal_thesaurus_extraction_runs" (
  "id"                 TEXT PRIMARY KEY,
  "run_type"           TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'running',
  "source_scope"       TEXT,
  "batch_size"         INTEGER,
  "started_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "finished_at"        TIMESTAMPTZ,
  "total_articles"     INTEGER NOT NULL DEFAULT 0,
  "processed_articles" INTEGER NOT NULL DEFAULT 0,
  "created_concepts"   INTEGER NOT NULL DEFAULT 0,
  "created_terms"      INTEGER NOT NULL DEFAULT 0,
  "created_relations"  INTEGER NOT NULL DEFAULT 0,
  "errors_count"       INTEGER NOT NULL DEFAULT 0,
  "notes"              TEXT,
  "metadata_json"      JSONB
);

-- 2) دفعات المعالجة
CREATE TABLE IF NOT EXISTS "legal_thesaurus_article_batches" (
  "id"            TEXT PRIMARY KEY,
  "run_id"        TEXT REFERENCES "legal_thesaurus_extraction_runs"("id") ON DELETE CASCADE,
  "batch_number"  INTEGER NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "article_count" INTEGER NOT NULL DEFAULT 0,
  "started_at"    TIMESTAMPTZ,
  "finished_at"   TIMESTAMPTZ,
  "error_message" TEXT,
  "metadata_json" JSONB
);
CREATE INDEX IF NOT EXISTS "idx_thes_batches_run" ON "legal_thesaurus_article_batches"("run_id");

-- 3) لقطات النصوص المعالجة (لا تُغيّر النص الأصلي)
CREATE TABLE IF NOT EXISTS "legal_thesaurus_text_snapshots" (
  "id"              TEXT PRIMARY KEY,
  "article_id"      TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL,
  "legal_source_id" TEXT REFERENCES "legal_systems"("id") ON DELETE SET NULL,
  "original_text"   TEXT NOT NULL,
  "normalized_text" TEXT,
  "searchable_text" TEXT,
  "sentences_json"  JSONB,
  "paragraphs_json" JSONB,
  "text_hash"       TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_thes_snapshot_article" ON "legal_thesaurus_text_snapshots"("article_id");
CREATE INDEX IF NOT EXISTS "idx_thes_snapshot_hash" ON "legal_thesaurus_text_snapshots"("text_hash");

-- 4) المصطلحات المرشّحة (قبل اعتمادها مفاهيم)
CREATE TABLE IF NOT EXISTS "legal_thesaurus_candidate_terms" (
  "id"                  TEXT PRIMARY KEY,
  "term_text"           TEXT NOT NULL,
  "normalized_term"     TEXT NOT NULL,
  "term_length"         INTEGER,
  "term_type_candidate" TEXT,
  "source_article_id"   TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL,
  "legal_source_id"     TEXT REFERENCES "legal_systems"("id") ON DELETE SET NULL,
  "article_number"      INTEGER,
  "evidence_quote"      TEXT,
  "extraction_method"   TEXT,
  "frequency_count"     INTEGER NOT NULL DEFAULT 1,
  "confidence_score"    INTEGER,
  "status"              TEXT NOT NULL DEFAULT 'auto_candidate',
  "review_reason"       TEXT,
  "run_id"              TEXT REFERENCES "legal_thesaurus_extraction_runs"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_thes_cand_norm" ON "legal_thesaurus_candidate_terms"("normalized_term");
CREATE INDEX IF NOT EXISTS "idx_thes_cand_status" ON "legal_thesaurus_candidate_terms"("status");

-- 5) المفاهيم
CREATE TABLE IF NOT EXISTS "legal_thesaurus_concepts" (
  "id"                   TEXT PRIMARY KEY,
  "preferred_label_ar"   TEXT NOT NULL,
  "normalized_label"     TEXT NOT NULL,
  "concept_type"         TEXT NOT NULL DEFAULT 'general_legal_concept',
  "legal_domain_primary" TEXT,
  "definition_type"      TEXT,
  "definition_text"      TEXT,
  "confidence_score"     INTEGER,
  "source_basis"         TEXT,
  "status"               TEXT NOT NULL DEFAULT 'candidate',
  "needs_human_review"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_thes_concept_norm" ON "legal_thesaurus_concepts"("normalized_label");
CREATE INDEX IF NOT EXISTS "idx_thes_concept_domain" ON "legal_thesaurus_concepts"("legal_domain_primary");

-- 6) المصطلحات/المرادفات التابعة لمفهوم
CREATE TABLE IF NOT EXISTS "legal_thesaurus_terms" (
  "id"               TEXT PRIMARY KEY,
  "concept_id"       TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "term_text"        TEXT NOT NULL,
  "normalized_term"  TEXT NOT NULL,
  "term_type"        TEXT NOT NULL DEFAULT 'related_expression',
  "confidence_score" INTEGER,
  "status"           TEXT NOT NULL DEFAULT 'candidate',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_thes_term_concept" ON "legal_thesaurus_terms"("concept_id");
CREATE INDEX IF NOT EXISTS "idx_thes_term_norm" ON "legal_thesaurus_terms"("normalized_term");

-- 7) مواضع الورود (ربط المفهوم/المصطلح بالمواد)
CREATE TABLE IF NOT EXISTS "legal_thesaurus_occurrences" (
  "id"              TEXT PRIMARY KEY,
  "concept_id"      TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "term_id"         TEXT REFERENCES "legal_thesaurus_terms"("id") ON DELETE SET NULL,
  "article_id"      TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL,
  "legal_source_id" TEXT REFERENCES "legal_systems"("id") ON DELETE SET NULL,
  "article_number"  INTEGER,
  "occurrence_text" TEXT,
  "sentence_text"   TEXT,
  "paragraph_text"  TEXT,
  "position_start"  INTEGER,
  "position_end"    INTEGER,
  "occurrence_type" TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_thes_occ_concept" ON "legal_thesaurus_occurrences"("concept_id");
CREATE INDEX IF NOT EXISTS "idx_thes_occ_article" ON "legal_thesaurus_occurrences"("article_id");

-- 8) التعريفات
CREATE TABLE IF NOT EXISTS "legal_thesaurus_definitions" (
  "id"                TEXT PRIMARY KEY,
  "concept_id"        TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "definition_text"   TEXT NOT NULL,
  "definition_type"   TEXT NOT NULL DEFAULT 'contextual_definition',
  "source_article_id" TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL,
  "evidence_quote"    TEXT,
  "confidence_score"  INTEGER,
  "status"            TEXT NOT NULL DEFAULT 'candidate',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_thes_def_concept" ON "legal_thesaurus_definitions"("concept_id");

-- 9) العلاقات بين المفاهيم
CREATE TABLE IF NOT EXISTS "legal_thesaurus_relations" (
  "id"                TEXT PRIMARY KEY,
  "source_concept_id" TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "target_concept_id" TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "relation_type"     TEXT NOT NULL,
  "confidence_score"  INTEGER,
  "evidence_article_id" TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL,
  "evidence_quote"    TEXT,
  "explanation"       TEXT,
  "status"            TEXT NOT NULL DEFAULT 'candidate',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_thes_rel_source" ON "legal_thesaurus_relations"("source_concept_id");
CREATE INDEX IF NOT EXISTS "idx_thes_rel_target" ON "legal_thesaurus_relations"("target_concept_id");

-- 10) المجالات القانونية
CREATE TABLE IF NOT EXISTS "legal_thesaurus_domains" (
  "id"         TEXT PRIMARY KEY,
  "name_ar"    TEXT NOT NULL,
  "slug"       TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_thes_domain_name" ON "legal_thesaurus_domains"("name_ar");

-- 11) ربط المفاهيم بالمجالات (متعدّد)
CREATE TABLE IF NOT EXISTS "legal_thesaurus_concept_domains" (
  "id"               TEXT PRIMARY KEY,
  "concept_id"       TEXT REFERENCES "legal_thesaurus_concepts"("id") ON DELETE CASCADE,
  "domain_id"        TEXT REFERENCES "legal_thesaurus_domains"("id") ON DELETE CASCADE,
  "weight"           DOUBLE PRECISION DEFAULT 1.0,
  "confidence_score" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_thes_cd_unique" ON "legal_thesaurus_concept_domains"("concept_id","domain_id");

-- 12) قائمة المراجعة البشرية
CREATE TABLE IF NOT EXISTS "legal_thesaurus_review_queue" (
  "id"              TEXT PRIMARY KEY,
  "item_type"       TEXT NOT NULL,
  "item_id"         TEXT,
  "issue_type"      TEXT,
  "proposed_action" TEXT,
  "evidence_json"   JSONB,
  "reviewer_notes"  TEXT,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewed_at"     TIMESTAMPTZ,
  "reviewed_by"     TEXT
);
CREATE INDEX IF NOT EXISTS "idx_thes_review_status" ON "legal_thesaurus_review_queue"("status");
CREATE INDEX IF NOT EXISTS "idx_thes_review_item" ON "legal_thesaurus_review_queue"("item_type","item_id");

-- بذر المجالات القانونية الأولية (idempotent عبر الاسم الفريد)
INSERT INTO "legal_thesaurus_domains" ("id","name_ar","slug")
VALUES
  (md5('مدني'),'مدني','civil'),
  (md5('تجاري'),'تجاري','commercial'),
  (md5('جزائي'),'جزائي','criminal'),
  (md5('إداري'),'إداري','administrative'),
  (md5('عمالي'),'عمالي','labor'),
  (md5('زكوي وضريبي'),'زكوي وضريبي','tax'),
  (md5('أحوال شخصية'),'أحوال شخصية','family'),
  (md5('تنفيذ'),'تنفيذ','enforcement'),
  (md5('مرافعات'),'مرافعات','procedure'),
  (md5('إثبات'),'إثبات','evidence'),
  (md5('توثيق'),'توثيق','notarization'),
  (md5('تحكيم'),'تحكيم','arbitration'),
  (md5('شركات'),'شركات','companies'),
  (md5('إفلاس'),'إفلاس','bankruptcy'),
  (md5('عقاري'),'عقاري','realestate'),
  (md5('ملكية فكرية'),'ملكية فكرية','ip'),
  (md5('حوكمة'),'حوكمة','governance'),
  (md5('عقوبات'),'عقوبات','penalties'),
  (md5('إجراءات'),'إجراءات','procedures')
ON CONFLICT ("name_ar") DO NOTHING;
