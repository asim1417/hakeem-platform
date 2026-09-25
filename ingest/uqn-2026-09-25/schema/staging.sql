-- =====================================================================
-- حزمة إدخال أم القرى إلى حكيم — مخطط المنطقة الوسيطة (staging)
-- PostgreSQL (Neon). لا يمس الجداول الرئيسية. قابل لإعادة التشغيل.
-- الجداول الرئيسية (legal_work / legal_expression / document_units /
-- legal_effect / DocumentRelation / IngestRun) يحددها المستودع؛
-- هذا الملف يعرّف فقط منطقة الاستقبال والفحص.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS uqn_stage;

-- دفعة الإدخال (سجل تشغيل)
CREATE TABLE IF NOT EXISTS uqn_stage.batch (
  batch_id        text PRIMARY KEY,               -- مثل: uqn-2026-09-25
  source          text NOT NULL DEFAULT 'uqn.gov.sa',
  retrieved_on    date NOT NULL,
  loaded_at       timestamptz NOT NULL DEFAULT now(),
  package_sha     text,
  notes           text
);

-- الأعمال التشريعية (أنظمة، تنظيمات، ترتيبات، لوائح، قواعد)
CREATE TABLE IF NOT EXISTS uqn_stage.work (
  batch_id            text NOT NULL REFERENCES uqn_stage.batch(batch_id),
  source_id           text NOT NULL,                -- uqn:<رقم الصفحة>
  dataset             text NOT NULL CHECK (dataset IN ('laws','regulations')),
  title               text NOT NULL,
  work_type           text NOT NULL,
  category            text,
  published_hijri     text CHECK (published_hijri IS NULL OR published_hijri ~ '^\d{4}-\d{2}-\d{2}$' OR published_hijri = ''),
  published_gregorian date,
  source_url          text NOT NULL,
  royal_decree_no     text,
  royal_decree_date_hijri text,
  approval_kind       text,
  approval_no         text,
  approval_date_hijri text,
  effective_clause    text,
  supersedes_note     text,
  parent_law_hint     text,
  numbering           text CHECK (numbering IN ('articles','clauses')),
  parse_status        text,                          -- complete | irregular_sequence | unstructured | no_text_image_or_pdf | needs_triage
  article_count       int  NOT NULL DEFAULT 0,
  sequence_contiguous boolean,
  flags               text[] NOT NULL DEFAULT '{}',
  quality_note        text,
  raw_sha             text,
  review_status       text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','accepted','rejected','needs_fix')),
  review_reason       text,
  PRIMARY KEY (batch_id, source_id)
);

-- الوحدات النصية بالترتيب من أول حرف
CREATE TABLE IF NOT EXISTS uqn_stage.unit (
  batch_id    text NOT NULL,
  source_id   text NOT NULL,
  seq         int  NOT NULL CHECK (seq >= 1),
  unit_type   text NOT NULL CHECK (unit_type IN ('enacting_instrument','approval_instrument','preamble','article','clause','unstructured_body')),
  number      int,
  label       text,
  heading     text,
  chapter     text,
  section     text,
  body        text NOT NULL,
  text_sha    text NOT NULL,
  source_url  text,
  PRIMARY KEY (batch_id, source_id, seq),
  FOREIGN KEY (batch_id, source_id) REFERENCES uqn_stage.work(batch_id, source_id) ON DELETE CASCADE,
  CHECK ((unit_type IN ('article','clause')) = (number IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS unit_num_idx ON uqn_stage.unit(source_id, unit_type, number);

-- الآثار التشريعية (تعديل/إضافة/حذف/إلغاء/إحلال/إصدار) — لا تُطبّق هنا
CREATE TABLE IF NOT EXISTS uqn_stage.effect (
  batch_id              text NOT NULL REFERENCES uqn_stage.batch(batch_id),
  effect_id             text NOT NULL,
  effect_type           text NOT NULL CHECK (effect_type IN ('amend','insert','delete','repeal','replace','enact','amend_or_repeal_unclassified')),
  instrument_kind       text NOT NULL,
  instrument_no         text,
  instrument_date_hijri text,
  published_hijri       text,
  target_title_as_cited text,
  target_citation       text,
  target_match_hakeem   text,
  target_match_status   text,
  operative_text        text NOT NULL,
  source_url            text NOT NULL,
  also_published_in     jsonb NOT NULL DEFAULT '[]',
  extraction            text NOT NULL DEFAULT 'automatic',
  status                text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','rejected','applied')),
  resolved_work_id      text,        -- يملؤه الوكيل بعد الربط بمعرّف حكيم الدائم
  resolved_unit_refs    text[],      -- المواد/الفقرات المتأثرة بعد التحليل
  PRIMARY KEY (batch_id, effect_id)
);

-- الإحلالات (نظام جديد محل قديم في حكيم)
CREATE TABLE IF NOT EXISTS uqn_stage.supersession (
  batch_id          text NOT NULL REFERENCES uqn_stage.batch(batch_id),
  new_source_url    text NOT NULL,
  new_title         text NOT NULL,
  published_hijri   text,
  hakeem_old_work_hint text,
  status            text NOT NULL DEFAULT 'pending_review',
  PRIMARY KEY (batch_id, new_source_url)
);

-- رفض الفحوص (يملؤه validate / tests)
CREATE TABLE IF NOT EXISTS uqn_stage.rejection (
  batch_id  text NOT NULL,
  object    text NOT NULL,       -- work | unit | effect
  key       text NOT NULL,
  rule      text NOT NULL,
  detail    text,
  at        timestamptz NOT NULL DEFAULT now()
);
