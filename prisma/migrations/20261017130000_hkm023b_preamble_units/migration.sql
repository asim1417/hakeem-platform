-- HKM-023-B ب-١: وحدات مقدمة النظام (أدوات الإصدار) — ترحيل إضافي فقط.
--
-- لماذا جدولان جديدان لا document_units:
--   طلب #631 (legal_documents/document_units) أُغلق دون دمج في 2026-10-17، وهجرته 20260809120000 ليست في main
--   ولم تُطبَّق على الإنتاج (تحقق: لا جدول document_units في neondb)، وقرار HKM-028 ألا يُعاد بناؤه كي لا ينشأ
--   نموذج موازٍ لـ unit_version/verification. فهذان الجدولان مقصوران على المقدمة، وأسماء أعمدتهما على تصميم #631
--   (unit_type، ordinal، parent_id، label_ar، number، text_raw، text_normalized، path، char_start، char_end،
--   source_url) ليسهل الضم إن أُحيي ذلك النموذج.
--
-- القواعد:
--   • لا ALTER ولا DROP ولا UPDATE ولا DELETE على جدول قائم. legal_systems.preamble («المادة صفر» في الأمر) لا يُمس،
--     ويُربط بالنسخة الجديدة ببصمته فقط (legacy_preamble_sha256).
--   • الجدولان للإضافة فقط (مشغّل hakeem_append_only على UPDATE/DELETE/TRUNCATE). التصحيح نسخة جديدة تحل محل السابقة.
--   • إعادة التركيب الحرفي مفروضة في القاعدة: مجموع text_raw لوحدات النسخة بترتيب ordinal = raw_text، وتبليط متصل،
--     وعدد الوحدات = units_count؛ يُفحص عند الالتزام (قيد مؤجل). تفكيك لا يعيد الأصل لا يُحفظ.
--   • الكتابة = نشر من مكتب التحرير (نوع التغيير import_preamble) بعد اعتماد معتمِد غير المُعِدّ: ف١١ للمالك.
--   • لا تعبئة في هذه الهجرة.
--
-- طريق التطبيق: يدوي فقط. لا مسار آلي يطبّقه (أمر البناء: prisma generate && next build؛ ولا workflow يقرأ هذا المجلد
-- إلا بالاسم الصريح لملفه). لا يُطبَّق على الإنتاج إلا باعتماد فردي من المالك (ف١٠)، وعلى فرع أولًا.
-- التراجع (قبل أي استعمال، وباعتماد): DROP VIEW preamble_unit_current; DROP TABLE preamble_unit, preamble_edition;
--   DROP FUNCTION hkm023b_verify_preamble_edition(text), hkm023b_preamble_edition_check(), hkm023b_preamble_unit_check();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hakeem_append_only') THEN
    CREATE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $b$
      BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME; END; $b$;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- preamble_edition: نسخة مقدمة واحدة لنظام = النص الحرفي من المصدر الرسمي + بصمته + مصدره + من أعدّه ومن اعتمده.
-- النسخة السارية لنظام = أحدث صف له (created_at)؛ supersedes_edition_id يوثّق الإحلال.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "preamble_edition" (
  "id" TEXT PRIMARY KEY,
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id"),
  "raw_text" TEXT NOT NULL CHECK (length("raw_text") > 0),
  "raw_sha256" TEXT NOT NULL CHECK ("raw_sha256" ~ '^[0-9a-f]{64}$'),
  "source_name" TEXT NOT NULL CHECK ("source_name" IN ('أم القرى', 'هيئة الخبراء بمجلس الوزراء')),
  "source_url" TEXT NOT NULL CHECK ("source_url" ~ '^https://'),
  "source_retrieved_on" DATE NOT NULL,
  -- مرجع اختياري للقطة المحفوظة التي نُقل منها النص (مثل law_card.id)، حين لا يُلصق من المصدر مباشرة.
  "source_record" TEXT,
  "completeness" TEXT NOT NULL CHECK ("completeness" IN ('complete', 'partial', 'issuance_line')),
  "parser_version" TEXT NOT NULL,
  "units_count" INTEGER NOT NULL CHECK ("units_count" > 0),
  -- بصمة legal_systems.preamble وقت الاستيراد: ربط بالمادة صفر دون مساسها.
  "legacy_preamble_sha256" TEXT CHECK ("legacy_preamble_sha256" IS NULL OR "legacy_preamble_sha256" ~ '^[0-9a-f]{64}$'),
  "supersedes_edition_id" TEXT REFERENCES "preamble_edition"("id"),
  -- معرّف التغيير في مكتب التحرير الذي نشر النسخة.
  "change_ref" TEXT NOT NULL,
  "prepared_by" TEXT NOT NULL,
  "approved_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("approved_by" <> "prepared_by"),
  CHECK ("supersedes_edition_id" IS NULL OR "supersedes_edition_id" <> "id"),
  UNIQUE ("system_id", "raw_sha256")
);
CREATE INDEX IF NOT EXISTS "preamble_edition_system_idx" ON "preamble_edition" ("system_id", "created_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- preamble_unit: وحدات النسخة. issuing_instrument أب بلا نص (النوع والرقم والتاريخ)، وما عداه يُبلِّط النص.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "preamble_unit" (
  "id" TEXT PRIMARY KEY,
  "edition_id" TEXT NOT NULL REFERENCES "preamble_edition"("id"),
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id"),
  "parent_id" TEXT REFERENCES "preamble_unit"("id"),
  "unit_type" TEXT NOT NULL CHECK ("unit_type" IN (
    'issuing_instrument', 'preamble_heading', 'opening', 'recital',
    'enacting_formula', 'operative_clause', 'signature', 'unclassified'
  )),
  "ordinal" INTEGER NOT NULL CHECK ("ordinal" >= 0),
  "instrument_index" INTEGER CHECK ("instrument_index" IS NULL OR "instrument_index" > 0),
  "instrument_kind" TEXT CHECK ("instrument_kind" IS NULL OR "instrument_kind" IN ('royal_decree', 'royal_order', 'cabinet_decision', 'other')),
  "instrument_number" TEXT,
  "instrument_date_hijri" TEXT,
  "label_ar" TEXT,
  "number" TEXT,
  "text_raw" TEXT NOT NULL,
  -- نص البحث المطبَّع (ع-١٤)، بنفس تطبيع legal_articles.search_norm. فارغ للأب.
  "text_normalized" TEXT,
  "path" TEXT NOT NULL,
  "anchor" TEXT,
  "char_start" INTEGER NOT NULL CHECK ("char_start" >= 0),
  "char_end" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("char_end" >= "char_start"),
  -- الأب بلا نص ولا أب، وغيره بنص غير فارغ طوله = مداه.
  CHECK (("unit_type" = 'issuing_instrument') = ("text_raw" = '')),
  CHECK ("unit_type" <> 'issuing_instrument' OR ("parent_id" IS NULL AND "instrument_index" IS NOT NULL)),
  CHECK ("unit_type" = 'issuing_instrument' OR "char_end" - "char_start" = length("text_raw")),
  UNIQUE ("edition_id", "ordinal"),
  UNIQUE ("edition_id", "path")
);
CREATE INDEX IF NOT EXISTS "preamble_unit_edition_idx" ON "preamble_unit" ("edition_id", "ordinal");
CREATE INDEX IF NOT EXISTS "preamble_unit_system_idx" ON "preamble_unit" ("system_id");
CREATE INDEX IF NOT EXISTS "preamble_unit_type_idx" ON "preamble_unit" ("unit_type");
-- البحث النصي (ع-١٤): بنفس فهارس legal_articles.search_norm.
CREATE INDEX IF NOT EXISTS "preamble_unit_norm_tsv_idx" ON "preamble_unit" USING gin (to_tsvector('simple', coalesce("text_normalized", '')));
CREATE INDEX IF NOT EXISTS "preamble_unit_norm_trgm_idx" ON "preamble_unit" USING gin ("text_normalized" gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- فحص إعادة التركيب الحرفي (قيد مؤجل إلى الالتزام).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION hkm023b_verify_preamble_edition(p_edition TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  e RECORD;
  n_units INTEGER;
  rebuilt TEXT;
  gaps INTEGER;
  bad_parent INTEGER;
BEGIN
  SELECT id, system_id, raw_text, units_count INTO e FROM preamble_edition WHERE id = p_edition;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'preamble_unit لنسخة غير موجودة: %', p_edition USING ERRCODE = 'foreign_key_violation';
  END IF;
  SELECT count(*) INTO n_units FROM preamble_unit WHERE edition_id = p_edition;
  IF n_units <> e.units_count THEN
    RAISE EXCEPTION 'نسخة المقدمة %: عدد الوحدات % ≠ units_count %', p_edition, n_units, e.units_count USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(string_agg(text_raw, '' ORDER BY ordinal), '') INTO rebuilt
    FROM preamble_unit WHERE edition_id = p_edition AND unit_type <> 'issuing_instrument';
  IF rebuilt IS DISTINCT FROM e.raw_text THEN
    RAISE EXCEPTION 'نسخة المقدمة %: إعادة التركيب لا تطابق النص الحرفي', p_edition USING ERRCODE = 'check_violation';
  END IF;
  -- التبليط متصل: كل وحدة تبدأ حيث انتهت سابقتها، والأولى من الصفر.
  SELECT count(*) INTO gaps FROM (
    SELECT char_start, lag(char_end, 1, 0) OVER (ORDER BY ordinal) AS prev_end
      FROM preamble_unit WHERE edition_id = p_edition AND unit_type <> 'issuing_instrument'
  ) t WHERE char_start <> prev_end;
  IF gaps > 0 THEN
    RAISE EXCEPTION 'نسخة المقدمة %: التبليط غير متصل (% موضع)', p_edition, gaps USING ERRCODE = 'check_violation';
  END IF;
  -- الأب من النسخة نفسها ومن نوع issuing_instrument، والنظام واحد.
  SELECT count(*) INTO bad_parent FROM preamble_unit u
    LEFT JOIN preamble_unit p ON p.id = u.parent_id
   WHERE u.edition_id = p_edition
     AND (u.system_id <> e.system_id
          OR (u.parent_id IS NOT NULL AND (p.edition_id IS DISTINCT FROM p_edition OR p.unit_type <> 'issuing_instrument')));
  IF bad_parent > 0 THEN
    RAISE EXCEPTION 'نسخة المقدمة %: وحدة بأب أو نظام غير صحيح', p_edition USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION hkm023b_preamble_edition_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM hkm023b_verify_preamble_edition(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION hkm023b_preamble_unit_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM hkm023b_verify_preamble_edition(NEW.edition_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS preamble_edition_verify ON "preamble_edition";
CREATE CONSTRAINT TRIGGER preamble_edition_verify AFTER INSERT ON "preamble_edition"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hkm023b_preamble_edition_check();
DROP TRIGGER IF EXISTS preamble_unit_verify ON "preamble_unit";
CREATE CONSTRAINT TRIGGER preamble_unit_verify AFTER INSERT ON "preamble_unit"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hkm023b_preamble_unit_check();

CREATE OR REPLACE TRIGGER preamble_edition_append_only BEFORE UPDATE OR DELETE ON "preamble_edition"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
CREATE OR REPLACE TRIGGER preamble_unit_append_only BEFORE UPDATE OR DELETE ON "preamble_unit"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
CREATE OR REPLACE TRIGGER preamble_edition_no_truncate BEFORE TRUNCATE ON "preamble_edition"
  FOR EACH STATEMENT EXECUTE FUNCTION hakeem_append_only();
CREATE OR REPLACE TRIGGER preamble_unit_no_truncate BEFORE TRUNCATE ON "preamble_unit"
  FOR EACH STATEMENT EXECUTE FUNCTION hakeem_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- الوحدات السارية: وحدات أحدث نسخة لكل نظام (بلا الأب). مصدر العرض والبحث.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW "preamble_unit_current" AS
SELECT u.*
  FROM "preamble_unit" u
  JOIN (
    SELECT DISTINCT ON (system_id) id
      FROM "preamble_edition"
     ORDER BY system_id, created_at DESC, id DESC
  ) cur ON cur.id = u.edition_id
 WHERE u.unit_type <> 'issuing_instrument';
