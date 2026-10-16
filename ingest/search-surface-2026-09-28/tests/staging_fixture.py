"""مختبر محلي فقط (127.0.0.1): يبني قاعدة تجريبية بأشكال الإنتاج نفسها للموجة ١.

الأسماء والنوافذ وحالات التحقق منقولة من ملف التسليم (قراءة الإنتاج 2026-09-28).
نصوص المواد هنا نصوص اختبار قصيرة، لا نصوص رسمية، ولا تُنقل إلى أي قاعدة أخرى.
يرفض أي مضيف غير 127.0.0.1/localhost.
"""
import hashlib
import os
import sys

import psycopg

URL = os.environ.get("DATABASE_URL", "")
H = URL.split("@")[-1].split("/")[0].split(":")[0]
if H not in ("127.0.0.1", "localhost"):
    raise SystemExit("المختبر المحلي فقط")


def sid(prefix, *parts):
    return prefix + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


DDL = """
CREATE SCHEMA IF NOT EXISTS uqn_fix;
CREATE TABLE IF NOT EXISTS legal_systems (
  id text PRIMARY KEY, name text UNIQUE NOT NULL, "articleCount" int NOT NULL DEFAULT 0,
  preamble text, preamble_royal_decree text, eli_slug text UNIQUE, domain text, domain_title text,
  instrument_kind text, "sortOrder" int DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS legal_articles (
  id text PRIMARY KEY, "legalSystemId" text REFERENCES legal_systems(id), "lawName" text NOT NULL,
  "articleNumber" int NOT NULL, title text NOT NULL, content text NOT NULL, "royalDecree" text,
  status text NOT NULL DEFAULT 'سارية', search_norm text,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY, object_type text NOT NULL, object_id text NOT NULL, verified_status text NOT NULL,
  evidence_instrument text, evidence_url text, evidence_quote text,
  method text NOT NULL CHECK (method IN ('rule','manual','owner_decision')), verified_by text,
  verified_at timestamptz NOT NULL DEFAULT now(), supersedes_verification_id text);
CREATE TABLE IF NOT EXISTS work_edition (
  id text PRIMARY KEY, mixed_system_id text NOT NULL, edition_system_id text NOT NULL, instrument text,
  role text NOT NULL CHECK (role IN ('old','new')), valid_from date NOT NULL, valid_to date,
  created_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hakeem_append_only') THEN
    CREATE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $b$
      BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME; END; $b$;
  END IF;
END $$;
CREATE OR REPLACE TRIGGER verification_append_only BEFORE UPDATE OR DELETE ON verification
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
"""

SYSTEMS: list[tuple[str, str, list[tuple[int, str, str]]]] = []  # (id, name, [(n, text, status)])


def law(name, n=3, text=None, status="سارية", sid_=None):
    i = sid_ or sid("fx-", name)
    arts = [(k, (text or f"نص اختبار للمادة {k} من {name}") + f" ({k})", status) for k in range(1, n + 1)]
    SYSTEMS.append((i, name, arts))
    return i


# العائلات الثلاث (المخلوط + الإصدارات)
EXE = "نظام التنفيذ"
EXE_OLD = "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ"
EXE_NEW = "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ"
CR = "نظام السجل التجاري"
CR_OLD = "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/1) وتاريخ 1416/2/21هـ"
CR_NEW = "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ"
TN = "نظام الأسماء التجارية"
TN_OLD = "نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/15) وتاريخ 1420/8/12هـ"
TN_NEW = "نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ"

ids = {}
ids[EXE] = law(EXE, 98, "يقصد بقاضي التنفيذ في المخلوط")
ids[EXE_OLD] = law(EXE_OLD, 98, "يقصد بقاضي التنفيذ في م/53", sid_=sid("ed25-", "system", EXE_OLD))
ids[EXE_NEW] = law(EXE_NEW, 65, "يقصد بقاضي التنفيذ في م/237", sid_=sid("ed25-", "system", EXE_NEW))
ids[CR] = law(CR, 29, "السجل التجاري المخلوط")
ids[CR_OLD] = law(CR_OLD, 20, "السجل التجاري م/1", sid_=sid("ed25-", "system", CR_OLD))
ids[CR_NEW] = law(CR_NEW, 29, "السجل التجاري م/83", sid_=sid("ed25-", "system", CR_NEW))
ids[TN] = law(TN, 23, "الأسماء التجارية المخلوط")
ids[TN_OLD] = law(TN_OLD, 20, "الأسماء التجارية م/15", sid_=sid("ed25-", "system", TN_OLD))
ids[TN_NEW] = law(TN_NEW, 23, "الأسماء التجارية م/83", sid_=sid("ed25-", "system", TN_NEW))
ids["نظام المعاملات المدنية"] = law("نظام المعاملات المدنية", 5, "الغبن في العقود")

# الأزواج العشرون (الأقصر ⊂ الأطول)
PAIRS = [
    ("نظام العمل", "نظام العمل التطوعي"),
    ("نظام البريد", "نظام البريد 1406هـ"),
    ("نظام الإحصاء", "نظام الإحصاءات العامة للدولة"),
    ("نظام الإيداع", "نظام الإيداع في المخازن العامة"),
    ("نظام التنفيذ", "نظام التنفيذ أمام ديوان المظالم"),
    ("نظام الزراعة", "نظام الزراعة العضوية"),
    ("نظام الشركات", "نظام الشركات المهنية"),
    ("نظام المناطق", "نظام المناطق البحرية للمملكة العربية السعودية"),
    ("نظام الاستثمار", "نظام الاستثمار الأجنبي"),
    ("نظام إدارة النفايات", "نظام إدارة النفايات البلدية الصلبة"),
    ("نظام الغرف التجارية", "نظام الغرف التجارية والصناعية"),
    ("تنظيم إعانة البحث عن عمل", "تنظيم إعانة البحث عن عمل 1432هـ"),
    ("نظام التسجيل العيني للعقار", "نظام التسجيل العيني للعقار 1423هـ"),
    ("نظام صندوق التنمية العقارية", "نظام صندوق التنمية العقارية1394هـ"),
    ("تنظيم وكالة الأنباء السعودية", "تنظيم وكالة الأنباء السعودية1433هـ"),
    ("تعليمات الحسابات الاستثمارية", "تعليمات الحسابات الاستثمارية المعدلة"),
    ("نظام إدارة المواد الكيميائية", "نظام استيراد المواد الكيميائية وإدارتها (نظام إدارة المواد الكيميائية)"),
    ("نظام تملك غير السعوديين للعقار", "نظام تملك غير السعوديين للعقار واستثماره"),
    ("نظام ملكية الوحدات العقارية وفرزها", "نظام ملكية الوحدات العقارية وفرزها وإدارتها"),
    (
        "الضوابط والمتطلبات والمواصفات الفنية والقواعد الإجرائية اللازمة لتنفيذ أحكام لائحة الفوترة الإلكترونية",
        "الضوابط والمتطلبات والمواصفات الفنية والقواعد الإجرائية اللازمة لتنفيذ أحكام لائحة الفوترة الإلكترونية - قرار محافظ الهيئة رقم (62738) وتاريخ 23/11/1443هـ",
    ),
]
for a, b in PAIRS:
    for nm in (a, b):
        if nm not in ids:
            ids[nm] = law(nm, 3, f"حكم خاص بـ {nm}")
ids["اللائحة التنفيذية لنظام العمل"] = law("اللائحة التنفيذية لنظام العمل", 3, "تفصيل لنظام العمل")

# الاثنا عشر ذوو المواد الملغاة كلها (بعضها من الأزواج أعلاه)
TWELVE = {
    "الترتيبات التنظيمية للمركز الوطني لسلامة النقل": "مستبدل",
    "الهيئة العامة للطرق": "مستبدل",
    "هيئة الصحة العامة": "مستبدل",
    "تنظيم الهيئة الوطنية لمكافحة الفساد": "ملغى",
    "نظام الإحصاءات العامة للدولة": "مستبدل",
    "نظام الاستثمار الأجنبي": "ملغى",
    "نظام النقل بالخطوط الحديدية": "مستبدل",
    "نظام تملك غير السعوديين للعقار واستثماره": "مستبدل",
    "نظام حماية حقوق المؤلف": "مستبدل",
    "نظام مدينة الملك عبدالله للطاقة الذرية والمتجددة": None,  # بلا تحقق — القاعدة: كل المواد ملغاة
    "نظام مكتبة الملك فهد الوطنية": "مستبدل",
    "نظام نزع ملكية العقارات للمنفعة العامة ووضع اليد المؤقت على العقار": "مستبدل",
}
REPEALED_IDS = set()
for nm in TWELVE:
    if nm in ids:
        # أعد بناء مواده ملغاة
        i = ids[nm]
        SYSTEMS[:] = [s for s in SYSTEMS if s[0] != i]
        law(nm, 3, f"مادة ملغاة الاستثمار حكم {nm}", status="ملغاة", sid_=i)
    else:
        ids[nm] = law(nm, 3, f"مادة ملغاة الاستثمار حكم {nm}", status="ملغاة")
    REPEALED_IDS.add(ids[nm])

# أنظمة البطاقات (أسماء حكيم كما في الحزمة)
for nm in ["نظام وثائق السفر", "نظام الآثار والمتاحف والتراث العمراني", "تنظيم هيئة الاتصالات والفضاء والتقنية",
           "نظام المواصفات والجودة", "نظام سلامة المنتجات", "نظام الإفلاس", "نظام الأوراق التجارية"]:
    if nm not in ids:
        ids[nm] = law(nm, 3, f"نص {nm}")
# نظام ساري يحوي كلمة الاستثمار لاختبار «لا يتصدر الملغى»
ids["نظام الاستثمار"] = ids.get("نظام الاستثمار") or law("نظام الاستثمار", 3)

WINDOWS = [
    (EXE, EXE_OLD, "old", "2012-07-03", "2026-10-28", "م/53 وتاريخ 1433/8/13هـ"),
    (EXE, EXE_NEW, "new", "2026-10-28", None, "مرسوم ملكي رقم م/237 بتاريخ 1447-11-03"),
    (CR, CR_OLD, "old", "1995-07-19", "2025-04-02", "م/1 وتاريخ 1416/2/21هـ"),
    (CR, CR_NEW, "new", "2025-04-02", None, "مرسوم ملكي رقم م/83 بتاريخ 1446-03-19"),
    (TN, TN_OLD, "old", "2000-11-18", "2025-04-02", "م/15 وتاريخ 1420/8/12هـ"),
    (TN, TN_NEW, "new", "2025-04-02", None, "مرسوم ملكي رقم م/83 بتاريخ 1446-03-19"),
]


def main():
    con = psycopg.connect(URL)
    with con.cursor() as cur:
        cur.execute(DDL)
        cur.execute("SELECT count(*) FROM legal_systems")
        if cur.fetchone()[0]:
            print("fixture exists; skipping inserts")
            con.commit()
            return
        for i, name, arts in SYSTEMS:
            cur.execute('INSERT INTO legal_systems (id,name,"articleCount","updatedAt") VALUES (%s,%s,%s,now())', (i, name, len(arts)))
            for n, text, st in arts:
                cur.execute(
                    'INSERT INTO legal_articles (id,"legalSystemId","lawName","articleNumber",title,content,status,search_norm,"updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now())',
                    (sid("fxa-", name, str(n)), i, name, n, f"المادة {n}", text, st, text),
                )
        for mixed, ed, role, vf, vt, ins in WINDOWS:
            cur.execute(
                "INSERT INTO work_edition (id,mixed_system_id,edition_system_id,instrument,role,valid_from,valid_to) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (sid("ed25-", "win", ids[mixed], ids[ed]), ids[mixed], ids[ed], ins, role, vf, vt),
            )

        def v(obj, st, method="manual"):
            cur.execute(
                "INSERT INTO verification (id,object_type,object_id,verified_status,method,verified_by) VALUES (%s,'work',%s,%s,%s,'fixture')",
                (sid("vf26-", "work", obj, st, method), obj, st, method),
            )

        for m in (EXE, CR, TN):
            v(ids[m], "سجل مخلوط — لا يُعرض")
        v(ids[EXE_OLD], "ساري"); v(ids[EXE_NEW], "صادر لم يسرِ بعد")
        v(ids[CR_OLD], "مستبدل"); v(ids[CR_NEW], "ساري")
        v(ids[TN_OLD], "مستبدل"); v(ids[TN_NEW], "ساري")
        for nm, st in TWELVE.items():
            if st:
                v(ids[nm], st)
        v(ids["نظام وثائق السفر"], "ساري")
    con.commit()
    print("fixture systems", len(SYSTEMS), "articles", sum(len(s[2]) for s in SYSTEMS))


if __name__ == "__main__":
    main()
