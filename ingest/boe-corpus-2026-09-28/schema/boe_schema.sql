-- قاعدة هيئة الخبراء المتكاملة (مخطط boe). إضافة فقط.
-- لا يمس أي جدول قائم في حكيم. كل الجداول هنا عليها مشغّل يمنع التعديل والحذف.
-- آخر صف زمنيًا لكل مفتاح هو المعتمد؛ أي تغيير = صف جديد.
CREATE SCHEMA IF NOT EXISTS boe;

CREATE OR REPLACE FUNCTION boe.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'boe is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME; END $$;

CREATE TABLE IF NOT EXISTS boe.crawl_run (
  id            text PRIMARY KEY,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  operator      text NOT NULL,
  origin        text NOT NULL,          -- من أين قُرئ (متصفح المالك)
  pace_ms       int NOT NULL,
  pages_ok      int NOT NULL,
  pages_failed  int NOT NULL,
  stop_reason   text,
  notes         text
);

-- فهرس «الوثائق النظامية» كما في صفحة المجلدات
CREATE TABLE IF NOT EXISTS boe.catalog (
  guid          text NOT NULL,
  run_id        text NOT NULL REFERENCES boe.crawl_run(id),
  tab           text NOT NULL,          -- أنظمة أساسية | أنظمة عادية | لوائح وما في حكمها | تنظيمات، وترتيبات تنظيمية
  category      text NOT NULL,          -- التصنيف الموضوعي
  name          text NOT NULL,
  PRIMARY KEY (guid, run_id)
);

-- لقطة الصفحة كما وردت (HTML مضغوط gzip) — الدليل الذي يُعاد منه كل تحليل
CREATE TABLE IF NOT EXISTS boe.page_snapshot (
  sha256        text PRIMARY KEY,
  guid          text NOT NULL,
  url           text NOT NULL,
  run_id        text NOT NULL REFERENCES boe.crawl_run(id),
  http_status   int NOT NULL,
  retrieved_at  timestamptz NOT NULL,
  html_gz       bytea NOT NULL,
  html_bytes    int NOT NULL
);
CREATE INDEX IF NOT EXISTS page_snapshot_guid_idx ON boe.page_snapshot (guid, retrieved_at DESC);

-- بطاقة النظام
CREATE TABLE IF NOT EXISTS boe.law (
  id                text PRIMARY KEY,   -- boe26- + تجزئة (guid|sha256)
  guid              text NOT NULL,
  snapshot_sha256   text NOT NULL REFERENCES boe.page_snapshot(sha256),
  url               text NOT NULL,
  name              text,
  name_en           text,
  description_en    text,
  summary           text,
  category_path     text[] NOT NULL DEFAULT '{}',
  issued_raw        text,
  issued_hijri      text,
  issued_gregorian  date,
  published_raw     text,
  published_hijri   text,
  published_gregorian date,
  status_at_source  text,
  instruments       jsonb NOT NULL DEFAULT '[]',
  article_count     int NOT NULL,
  parse_flags       text[] NOT NULL DEFAULT '{}',
  parsed_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS law_guid_idx ON boe.law (guid, parsed_at DESC);

-- كتل «نص النظام» قبل المواد، بترتيبها
CREATE TABLE IF NOT EXISTS boe.text_block (
  law_id     text NOT NULL REFERENCES boe.law(id),
  seq        int  NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('title','year','basmala','royal_decree','cabinet_decision','royal_order','preamble_other','law_title')),
  heading    text,
  body       text NOT NULL,
  PRIMARY KEY (law_id, seq)
);

-- المواد حرفيًا (النص المعروض في الهيئة = الأصل عند الإصدار)
CREATE TABLE IF NOT EXISTS boe.unit (
  law_id          text NOT NULL REFERENCES boe.law(id),
  seq             int  NOT NULL,
  heading         text NOT NULL,        -- «المادة العاشرة مكرر» كما وردت
  article_number  int,                  -- الرقم الأساسي؛ فارغ إن تعذّر
  is_bis          boolean NOT NULL DEFAULT false,
  body            text NOT NULL,
  body_html       text NOT NULL,
  body_sha256     text NOT NULL,
  css_class       text NOT NULL,        -- changed-article | canceled-article | ''
  PRIMARY KEY (law_id, seq)
);

-- ملاحظات التعديل تحت المادة، مفككة إلى آثار
CREATE TABLE IF NOT EXISTS boe.amendment_note (
  id                text PRIMARY KEY,
  law_id            text NOT NULL REFERENCES boe.law(id),
  unit_seq          int  NOT NULL,
  note_seq          int  NOT NULL,
  note_text         text NOT NULL,      -- نص الملاحظة الأصلي كاملًا
  effect            text NOT NULL CHECK (effect IN ('amend_article','amend_paragraph','amend_definition','amend_table','renumber_merge','repeal','delete','add','substitute_phrase','general','unclassified')),
  new_text          text,               -- النص الجديد بين علامتي التنصيص إن وُجد
  instrument_kind   text,
  instrument_no     text,
  instrument_date_hijri text,
  needs_review      boolean NOT NULL
);

-- الروابط إلى وثائق أخرى داخل الصفحة
CREATE TABLE IF NOT EXISTS boe.related_doc (
  law_id       text NOT NULL REFERENCES boe.law(id),
  target_guid  text NOT NULL,
  label        text NOT NULL,
  PRIMARY KEY (law_id, target_guid, label)
);

-- ربط نظام الهيئة بنظام حكيم (قرار؛ الأحدث هو المعتمد)
CREATE TABLE IF NOT EXISTS boe.match (
  id                text PRIMARY KEY,
  guid              text NOT NULL,
  hakeem_system_id  text,               -- فارغ = «لا مقابل في حكيم»
  method            text NOT NULL CHECK (method IN ('exact_name','normalized_name','owner')),
  candidates        jsonb NOT NULL DEFAULT '[]',
  decided_by        text NOT NULL,
  decided_at        timestamptz NOT NULL DEFAULT now()
);

-- مقارنة المواد المربوطة
CREATE TABLE IF NOT EXISTS boe.diff (
  id                text PRIMARY KEY,
  law_id            text NOT NULL REFERENCES boe.law(id),
  hakeem_system_id  text NOT NULL,
  article_number    int NOT NULL,
  is_bis            boolean NOT NULL DEFAULT false,
  hakeem_article_id text,
  verdict           text NOT NULL CHECK (verdict IN ('identical','whitespace_only','normalization_only','wording','missing_in_hakeem','missing_in_boe','unnumbered_unit')),
  boe_has_notes     boolean NOT NULL,
  detail            text,
  computed_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['crawl_run','catalog','page_snapshot','law','text_block','unit','amendment_note','related_doc','match','diff'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'no_change' AND tgrelid = ('boe.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER no_change BEFORE UPDATE OR DELETE ON boe.%I FOR EACH ROW EXECUTE FUNCTION boe.forbid_change()', t);
    END IF;
  END LOOP;
END $$;

-- الحالي: آخر تحليل لكل guid، وآخر قرار ربط لكل guid
CREATE OR REPLACE VIEW boe.current_law AS
  SELECT DISTINCT ON (guid) * FROM boe.law ORDER BY guid, parsed_at DESC, id DESC;
CREATE OR REPLACE VIEW boe.current_match AS
  SELECT DISTINCT ON (guid) * FROM boe.match ORDER BY guid, decided_at DESC, id DESC;
