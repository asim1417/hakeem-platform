-- وجه البحث + بطاقة النظام (إضافة فقط).
-- لا UPDATE ولا DELETE ولا DROP على جدول أو صف قائم. جداول جديدة فقط، وعليها مشغّل الإضافة فقط.
-- لا تعبئة في هذه الهجرة. التعبئة في ingest/search-surface-2026-09-28/.

-- دالة الإضافة فقط موجودة من هجرة طبقة التحقق؛ تُنشأ فقط إن غابت (لا استبدال لقائم).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hakeem_append_only') THEN
    CREATE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $b$
      BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME; END; $b$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- search_surface: أيّ نظام يظهر في صناديق البحث لكل «عمل» في تاريخ معيّن.
-- القراءة: لكل work_key آخر صف valid_on <= اليوم. surface_system_id فارغ = لا وجه ساريًا
-- (العمل في الأرشيف ويُفتح بالرابط المباشر فقط).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "search_surface" (
  "id" TEXT PRIMARY KEY,
  "work_key" TEXT NOT NULL,
  "surface_system_id" TEXT REFERENCES "legal_systems"("id"),
  "valid_on" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "supersedes_surface_id" TEXT REFERENCES "search_surface"("id"),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "search_surface_work_idx" ON "search_surface" ("work_key", "valid_on" DESC, "created_at" DESC);

-- أعضاء العمل: كل نظام ينتمي للعمل (المخلوط، الإصدارات، القديم والجديد).
-- كل عضو غير الوجه الحالي يخرج من صناديق البحث ويُحوَّل إليه عند ذكر اسمه.
CREATE TABLE IF NOT EXISTS "search_surface_member" (
  "id" TEXT PRIMARY KEY,
  "work_key" TEXT NOT NULL,
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id"),
  "role" TEXT NOT NULL CHECK ("role" IN ('mixed', 'edition_old', 'edition_new', 'retired', 'successor')),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("work_key", "system_id")
);
CREATE INDEX IF NOT EXISTS "search_surface_member_system_idx" ON "search_surface_member" ("system_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- law_card: بطاقة النظام كما تعرضها هيئة الخبراء — نبذة، الاسم، تاريخ الإصدار، تاريخ النشر،
-- الحالة كما في المصدر، أدوات الإصدار، مسار التصنيف، وكتل «نص النظام» قبل المواد.
-- آخر صف لكل system_id هو البطاقة. الحالة المعروضة للمستخدم تبقى من verification.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "law_card" (
  "id" TEXT PRIMARY KEY,
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id"),
  "official_name" TEXT NOT NULL,
  "summary" TEXT,
  "issued_hijri" TEXT,
  "issued_gregorian" DATE,
  "published_hijri" TEXT,
  "published_gregorian" DATE,
  "status_at_source" TEXT,
  "category_path" TEXT[] NOT NULL DEFAULT '{}',
  "instruments" JSONB NOT NULL DEFAULT '[]',
  "text_blocks" JSONB NOT NULL DEFAULT '[]',
  "source_name" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "retrieved_on" DATE NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof("instruments") = 'array'),
  CHECK (jsonb_typeof("text_blocks") = 'array')
);
CREATE INDEX IF NOT EXISTS "law_card_system_idx" ON "law_card" ("system_id", "created_at" DESC);

CREATE OR REPLACE TRIGGER search_surface_append_only BEFORE UPDATE OR DELETE ON "search_surface"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
CREATE OR REPLACE TRIGGER search_surface_member_append_only BEFORE UPDATE OR DELETE ON "search_surface_member"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
CREATE OR REPLACE TRIGGER law_card_append_only BEFORE UPDATE OR DELETE ON "law_card"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
