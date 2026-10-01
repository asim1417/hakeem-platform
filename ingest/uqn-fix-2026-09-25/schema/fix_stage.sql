-- =====================================================================
-- حزمة الإصلاح (الإضافة فقط) — منطقة استقبال مستقلة: uqn_fix
-- لا UPDATE ولا DELETE على أي جدول هنا ولا في الجداول الرئيسية.
-- القرار البشري يُسجَّل صفًّا جديدًا في amendment_review، ولا يُعدَّل صف العملية.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS uqn_fix;

-- لقطات المصادر: نص صفحة أم القرى كما جُلب — الدليل الذي تُقارن به كل عبارة
CREATE TABLE IF NOT EXISTS uqn_fix.source_snapshot (
  url          text PRIMARY KEY,
  body         text NOT NULL,
  body_sha     text NOT NULL,
  retrieved_on date NOT NULL
);

-- الإحلال والإلغاء على مستوى النظام (17 سجلًا: 16 مثبتة + 1 غير مثبتة)
CREATE TABLE IF NOT EXISTS uqn_fix.supersession_evidence (
  id                 bigserial PRIMARY KEY,
  old_title          text NOT NULL,
  old_hakeem_code    text,                 -- من قائمة حكيم المرجعية؛ الفارغ يُحلّ بالعنوان
  old_instrument     text,
  new_title          text NOT NULL,
  new_source_url     text,
  relation           text NOT NULL CHECK (relation IN ('replace','repeal','repeal_with_saving')),
  evidence_quote     text,                 -- النص الحرفي من الأداة
  evidence_url       text NOT NULL,
  evidence_location  text,
  published_hijri    text,
  effective_from_hijri     text,
  effective_from_gregorian date,
  effective_rule     text,
  status             text NOT NULL CHECK (status IN ('proven','not_proven')),
  notes              text,
  UNIQUE (old_title, new_title, relation)
);

-- أدوات إصدار الأعمال الستة عشر التي كانت بلا أداة
CREATE TABLE IF NOT EXISTS uqn_fix.issuance_instrument (
  id                   bigserial PRIMARY KEY,
  law_title            text NOT NULL,
  instrument_kind      text NOT NULL CHECK (instrument_kind IN ('cabinet_decision','royal_order','royal_circular','royal_decree')),
  instrument_no        text NOT NULL,
  instrument_date_hijri text NOT NULL,
  instrument_title     text,
  source_url           text NOT NULL,
  approving_clause     text NOT NULL,
  status               text NOT NULL CHECK (status = 'proven'),
  UNIQUE (law_title, source_url)
);

-- عمليات التعديل المستخرجة — مرشّحات، لا تُطبَّق إلا بعد قرار بشري
CREATE TABLE IF NOT EXISTS uqn_fix.amendment_op (
  op_id               text PRIMARY KEY,         -- بصمة محتوى ثابتة
  effect_id           text NOT NULL,
  instrument_kind     text NOT NULL,
  instrument_no       text,
  instrument_date_hijri text,
  published_hijri     text,
  source_url          text NOT NULL REFERENCES uqn_fix.source_snapshot(url),
  target_law_title    text NOT NULL,
  target_hakeem_code  text,
  target_resolution   text NOT NULL,
  op_type             text NOT NULL CHECK (op_type IN ('replace_article_text','replace_paragraph_text','insert_paragraph','insert_article',
                        'append_text','delete_paragraph','repeal_article','substitute_phrase','replace_definition','replace_definition_entry',
                        'replace_law','repeal_law','rename_law')),
  article_number      int,
  paragraph_label     text,
  term                text,
  new_text            text,
  old_phrase          text,
  new_phrase          text,
  scope               text,
  renumber            boolean,
  effective_from_hijri     text,
  effective_from_gregorian date,
  effective_rule      text,
  effective_clauses_in_instrument jsonb,
  risks               text[] NOT NULL DEFAULT '{}',
  confidence          text NOT NULL CHECK (confidence IN ('rule_exact','needs_review')),
  verbatim_in_source  boolean,
  evidence_quote      text NOT NULL,
  also_in             text[] NOT NULL DEFAULT '{}',
  raw                 jsonb NOT NULL
);

-- القرار البشري على كل عملية — صف جديد لكل قرار؛ آخر صف هو النافذ
CREATE TABLE IF NOT EXISTS uqn_fix.amendment_review (
  id           bigserial PRIMARY KEY,
  op_id        text NOT NULL REFERENCES uqn_fix.amendment_op(op_id),
  decision     text NOT NULL CHECK (decision IN ('approved','rejected','approved_with_edit')),
  corrected    jsonb,                 -- عند approved_with_edit: الحقول المصححة فقط
  reviewer     text NOT NULL,
  note         text,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'approved_with_edit' OR corrected IS NOT NULL)
);
CREATE OR REPLACE VIEW uqn_fix.amendment_decision AS
SELECT DISTINCT ON (op_id) op_id, decision, corrected, reviewer, decided_at
FROM uqn_fix.amendment_review ORDER BY op_id, decided_at DESC, id DESC;

-- الأدوات التي لم تُستخرج آليًّا (قائمة العمل اليدوي)
CREATE TABLE IF NOT EXISTS uqn_fix.amendment_manual (
  effect_id      text PRIMARY KEY,
  effect_type    text NOT NULL,
  instrument_kind text,
  instrument_no  text,
  instrument_date_hijri text,
  source_url     text NOT NULL,
  target_title_as_cited text,
  unparsed_items jsonb NOT NULL,
  ops_extracted  int NOT NULL
);

-- منع التعديل والحذف على مستوى القاعدة (حارس إضافي فوق قاعدة الأمر)
CREATE OR REPLACE FUNCTION uqn_fix.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'uqn_fix is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['source_snapshot','supersession_evidence','issuance_instrument','amendment_op','amendment_review','amendment_manual'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS no_change ON uqn_fix.%I', t);
    EXECUTE format('CREATE TRIGGER no_change BEFORE UPDATE OR DELETE ON uqn_fix.%I FOR EACH ROW EXECUTE FUNCTION uqn_fix.forbid_change()', t);
  END LOOP; END $$;

-- =====================================================================
-- أنظمة أُضيفت بقرار المالك (2026-09-25): الحالة «ساري»، والنص من مصدر ثانوي قيد المطابقة
-- =====================================================================
CREATE TABLE IF NOT EXISTS uqn_fix.new_law (
  title                   text PRIMARY KEY,
  title_as_published      text,
  work_type               text,
  royal_decree_no         text,
  royal_decree_date_hijri text,
  cabinet_decision_no     text,
  cabinet_decision_date_hijri text,
  published_hijri         text,
  status                  text NOT NULL CHECK (status = 'ساري'),
  status_basis            text NOT NULL,
  text_source             text NOT NULL,
  text_source_url         text NOT NULL REFERENCES uqn_fix.source_snapshot(url),
  official_url            text NOT NULL,
  text_verification       text NOT NULL CHECK (text_verification IN ('pending_official_match','matched_official')),
  text_currency_note      text,
  pending_amendment_op_ids text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS uqn_fix.new_law_unit (
  title     text NOT NULL REFERENCES uqn_fix.new_law(title),
  seq       int  NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('preamble','article')),
  number    int,
  label     text,
  body      text NOT NULL,
  PRIMARY KEY (title, seq)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['new_law','new_law_unit'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS no_change ON uqn_fix.%I', t);
    EXECUTE format('CREATE TRIGGER no_change BEFORE UPDATE OR DELETE ON uqn_fix.%I FOR EACH ROW EXECUTE FUNCTION uqn_fix.forbid_change()', t);
  END LOOP; END $$;
