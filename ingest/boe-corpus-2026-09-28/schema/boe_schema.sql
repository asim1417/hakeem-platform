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
  verdict           text NOT NULL CHECK (verdict IN ('identical','whitespace_only','normalization_only','wording','missing_in_hakeem','missing_in_boe','unnumbered_unit','shifted','version_mismatch')),
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

-- ── المرفقات: «أصل الوثيقة» والأدوات المعدِّلة (صور صفحات ممسوحة) ──
CREATE TABLE IF NOT EXISTS boe.attachment (
  id            text PRIMARY KEY,         -- boe26- + تجزئة الرابط
  href          text NOT NULL UNIQUE,     -- رابط العارض في الهيئة
  kind          text NOT NULL CHECK (kind IN ('original_document','amending_instrument','issuance_instrument','article_attachment')),
  law_guid      text NOT NULL,
  unit_seq      int,                      -- المادة التي ظهر تحتها المرفق (للأدوات المعدِّلة)
  label         text,
  page_count    int NOT NULL,
  retrieved_at  timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS boe.attachment_page (
  attachment_id text NOT NULL REFERENCES boe.attachment(id),
  page_no       int  NOT NULL,
  image_url     text NOT NULL,
  image_sha256  text NOT NULL,            -- الصورة نفسها محفوظة خارج القاعدة باسم البصمة
  image_bytes   int  NOT NULL,
  ocr_text      text,                     -- نص آلي تقريبي: الأرقام والتواريخ تحتاج مطابقة بالصورة
  ocr_engine    text,
  PRIMARY KEY (attachment_id, page_no)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['attachment','attachment_page'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'no_change' AND tgrelid = ('boe.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER no_change BEFORE UPDATE OR DELETE ON boe.%I FOR EACH ROW EXECUTE FUNCTION boe.forbid_change()', t);
    END IF;
  END LOOP;
END $$;

-- ── مراجعة ملاحظات التعديل غير المحسومة (اقتراح لا يُطبَّق إلا بقرار المالك) ──
CREATE TABLE IF NOT EXISTS boe.review_proposal (
  id               text PRIMARY KEY,        -- معرّف الملاحظة، و#رقم البند إن فُكّكت
  note_id          text NOT NULL REFERENCES boe.amendment_note(id),
  piece_no         int  NOT NULL DEFAULT 1,
  category         int  NOT NULL CHECK (category BETWEEN 1 AND 4),  -- 1 تعدد، 2 بلا أداة، 3 بلا نص جديد، 4 أثر غير صريح
  effect           text NOT NULL,           -- الأثر المقترح بالعربية
  effect_basis     text,
  instrument       text,
  instrument_date_hijri text,
  all_instruments  text,
  new_text         text,                    -- حرفي: من الملاحظة، أو من صورة الأداة بعد التحقق
  evidence         text NOT NULL,           -- اقتباس الملاحظة
  confidence       text NOT NULL CHECK (confidence IN ('مؤكد','مرجّح','يحتاج قرار المالك')),
  reason           text,
  attachment_href  text,
  image_url        text,
  image_page       int,
  ocr_draft        text,                    -- مسودة آلية للمطابقة فقط
  parser_effect    text,                    -- تصنيف المحلل الآلي الأول
  review_run       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_proposal_note_idx ON boe.review_proposal (note_id);

-- ── قراءة صور الأدوات بصريًا (الفئة 3) والتحقق المستقل منها ──
CREATE TABLE IF NOT EXISTS boe.vision_reading (
  note_id          text PRIMARY KEY REFERENCES boe.amendment_note(id),
  doc_group        text NOT NULL,
  status           text NOT NULL CHECK (status IN ('found','partial','not_found','consolidated_text','unreadable','not_applicable','wrong_article')),
  instrument_seen  text,                    -- الأداة كما طُبعت في الصورة
  instrument_match boolean,                 -- هل تطابق أداة الملاحظة
  lead_in          text,
  new_text         text,                    -- بعد تصحيحات التحقق
  pages            int[] NOT NULL DEFAULT '{}',
  image_sha256     text[] NOT NULL DEFAULT '{}',
  verify_verdict   text CHECK (verify_verdict IN ('exact','minor','wrong')),
  fixes_applied    text[] NOT NULL DEFAULT '{}',
  notes            text,
  read_run         text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── قرارات المالك (تُستورد من ملف المراجعة؛ الأحدث لكل اقتراح هو المعتمد) ──
CREATE TABLE IF NOT EXISTS boe.owner_decision (
  id           text PRIMARY KEY,
  proposal_id  text NOT NULL REFERENCES boe.review_proposal(id),
  decision     text NOT NULL CHECK (decision IN ('موافق','مرفوض','موافق مع تصحيح','مؤجل')),
  corrected_text text,
  owner_note   text,
  decided_by   text NOT NULL,
  decided_at   timestamptz NOT NULL DEFAULT now()
);

-- ── روابط المرفقات التي لم تُقرأ بعد (قائمة العمل للجولة الثانية) ──
CREATE TABLE IF NOT EXISTS boe.attachment_target (
  href       text PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('original_document','amending_instrument','issuance_instrument','article_attachment')),
  law_guid   text NOT NULL,
  label      text,
  priority   int  NOT NULL,                 -- 1 أدوات الإصدار والتعديل، 2 أصل الوثيقة، 3 مرفقات المواد
  listed_at  timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['review_proposal','vision_reading','owner_decision','attachment_target'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'no_change' AND tgrelid = ('boe.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER no_change BEFORE UPDATE OR DELETE ON boe.%I FOR EACH ROW EXECUTE FUNCTION boe.forbid_change()', t);
    END IF;
  END LOOP;
END $$;

-- ── واجهات القراءة ──
-- المرفق المقروء يخرج من قائمة العمل تلقائيًا
CREATE OR REPLACE VIEW boe.attachment_pending AS
  SELECT t.* FROM boe.attachment_target t
  WHERE NOT EXISTS (SELECT 1 FROM boe.attachment a WHERE a.href = t.href);

CREATE OR REPLACE VIEW boe.current_owner_decision AS
  SELECT DISTINCT ON (proposal_id) * FROM boe.owner_decision ORDER BY proposal_id, decided_at DESC, id DESC;

-- كل ملاحظة تعديل مع المادة والنظام واقتراح المراجعة وقراءة الصورة وقرار المالك
CREATE OR REPLACE VIEW boe.v_amendment AS
  SELECT l.guid AS law_guid, l.name AS law_name, l.status_at_source, u.seq AS unit_seq, u.heading AS unit_heading,
         u.css_class AS unit_class, n.id AS note_id, n.note_seq, n.note_text, n.effect AS parser_effect,
         n.instrument_kind, n.instrument_no, n.instrument_date_hijri, n.needs_review,
         COALESCE(p.new_text, n.new_text) AS new_text,
         CASE WHEN NOT n.needs_review THEN 'محسوم من الملاحظة' ELSE p.confidence END AS confidence,
         p.id AS proposal_id, p.category, p.effect AS proposed_effect, p.reason, p.image_url,
         v.status AS vision_status, v.instrument_seen, v.instrument_match, v.verify_verdict,
         d.decision AS owner_decision, d.corrected_text, l.url AS source_url
  FROM boe.amendment_note n
  JOIN boe.law l ON l.id = n.law_id
  JOIN boe.unit u ON u.law_id = n.law_id AND u.seq = n.unit_seq
  LEFT JOIN boe.review_proposal p ON p.note_id = n.id
  LEFT JOIN boe.vision_reading v ON v.note_id = n.id
  LEFT JOIN boe.current_owner_decision d ON d.proposal_id = p.id;

-- ملخص التغطية
CREATE OR REPLACE VIEW boe.v_coverage AS
  SELECT 'أنظمة محللة' AS item, count(*)::bigint AS n FROM boe.current_law
  UNION ALL SELECT 'مواد', count(*) FROM boe.unit
  UNION ALL SELECT 'ملاحظات تعديل', count(*) FROM boe.amendment_note
  UNION ALL SELECT 'ملاحظات تحتاج مراجعة', count(*) FROM boe.amendment_note WHERE needs_review
  UNION ALL SELECT 'اقتراحات مراجعة', count(*) FROM boe.review_proposal
  UNION ALL SELECT 'قراءات صور الأدوات', count(*) FROM boe.vision_reading
  UNION ALL SELECT 'قرارات المالك', count(*) FROM boe.owner_decision
  UNION ALL SELECT 'مرفقات مقروءة', count(*) FROM boe.attachment
  UNION ALL SELECT 'صفحات مرفقات', count(*) FROM boe.attachment_page
  UNION ALL SELECT 'مرفقات لم تُقرأ بعد', count(*) FROM boe.attachment_pending;
