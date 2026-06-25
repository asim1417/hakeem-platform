#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
classify_and_code_systems.py
يقرأ data/saudi_systems.json (485 نظامًا / 15,902 مادة) ويُنتج:
  data/legal_systems_classified.json — كل نظام مع: domain مُصحَّح، رمز فريد (code)،
  ترتيب، وعدد المواد. هذا هو «الأصل» المُصنَّف المرمَّز.
لا يعتمد على domain الآلي القديم (404 منها 'other')؛ يعيد التصنيف بقواعد على الاسم.
"""
import json, re, sys
from pathlib import Path

SRC = Path("data/saudi_systems.json")
OUT = Path("data/legal_systems_classified.json")

# ── المجالات المعتمدة + عناوينها العربية ──
DOMAINS = {
    "civil": "المعاملات المدنية",
    "commercial": "التجاري والشركات",
    "companies": "الشركات",
    "labor": "العمل والتأمينات",
    "criminal": "الجزائي والعقوبات",
    "procedure": "المرافعات والإجراءات",
    "enforcement": "التنفيذ",
    "personal_status": "الأحوال الشخصية",
    "arbitration": "التحكيم",
    "notarization": "التوثيق",
    "evidence": "الإثبات",
    "judiciary": "القضاء والنيابة",
    "realestate": "العقار والتسجيل العيني",
    "ip": "الملكية الفكرية",
    "tax_finance": "المالية والضرائب والبنوك",
    "consumer": "حماية المستهلك والمنافسة",
    "health": "الصحة والدواء",
    "admin": "الإداري والحوكمة العامة",
    "regulatory": "تنظيمي قطاعي",
}

# ── قواعد التصنيف بالاسم (تُطبَّق بالترتيب؛ أول مطابقة تفوز) ──
# كل قاعدة: (نمط regex على الاسم المُطبَّع, domain)
RULES = [
    (r"معاملات مدنية|المعاملات المدنية", "civil"),
    (r"احوال الشخصية|احوال شخصية|ولاية على أموال|قاصرين|التبرع بالأعضاء|أعضاء البشرية|وحدات الإخصاب", "personal_status"),
    (r"تحكيم", "arbitration"),
    (r"تنفيذ", "enforcement"),
    (r"إثبات|اثبات", "evidence"),
    (r"توثيق|كاتب عدل", "notarization"),
    (r"مرافعات|إجراءات الجزائية|اجراءات الجزائية|إجراءات جزائية", "procedure"),
    (r"قضاء|النيابة العامة|التحقيق والادعاء|محاكمة الوزراء|هيئة القضائية|ديوان المظالم", "judiciary"),
    (r"شركات|إفلاس|افلاس|مساهمات", "companies"),
    (r"محكمة التجارية|محاكم التجارية|تجاري|أوراق التجارية|اوراق التجارية|غرف التجارية|بحري التجاري|سجل تجاري", "commercial"),
    (r"عمل|تأمينات الاجتماعية|تامينات الاجتماعية|تقاعد|ضمان الاجتماعي|خدمة الضباط|خدمة الأفراد|خدمة المدنية|الموارد البشرية", "labor"),
    (r"جزائي|عقوبات|جرائم|مخدرات|إرهاب|ارهاب|أسلحة|اسلحة|متفجرات|غسل الأموال|غسل الاموال|سجن|توقيف|مكافحة الفساد|تستر", "criminal"),
    (r"عقار|تسجيل العيني|رهن العقاري|ملكية الوحدات|نزع ملكية|إيجار|ايجار|الخارطة|استئجار الدولة", "realestate"),
    (r"براءات|حقوق المؤلف|علامات|ملكية الفكرية|تصميمات", "ip"),
    (r"ضريبة|قيمة المضافة|دخل|بنك|بنوك|مراقبة البنوك|سوق المالية|التمويل|تمويلي|إيرادات|ايرادات|صندوق الاستثمار|محاسبين|محاسبة|مالية المهمة|إيداع|ايداع|مخازن|ضمان الحقوق بالأموال", "tax_finance"),
    (r"منافسة|مستهلك|غش|تجاري المضلل|مكافحة التجارية", "consumer"),
    (r"صحية|صحة|دواء|دوائي|صيدلان|طبية|طبي|غذاء|أعلاف|اعلاف|تجميل|إيدز|الايدز|عقم|أجنة|اجنة|إخصاب|اخصاب|بدائل حليب|نفسية|المهن الصحية|الحجر البيطري|نووية|الإشعاع", "health"),
    (r"محاماة|أخلاقيات البحث|مقيمين|المقيمين", "regulatory"),
]

# مجالات قطاعية واسعة (تنظيمية) — كلمات تدل على قطاع تنظيمي
REGULATORY_HINTS = r"اتصالات|طيران|نقل|خطوط الحديدية|بريد|مياه|بيئة|نفايات|طرق|مرور|مدن|بلدي|بلديات|آثار|متاحف|زراعة|تعديني|تعدين|هيدروكربون|طاقة|كهرباء|جمارك|مطبوعات|نشر|إعلام|اعلام|صحفية|تقنية المعلومات|تعاملات الإلكترونية|بيانات الشخصية|جمعيات|تعاونية|أهلية|كشافة|هلال الأحمر|حجاج|أوقاف|مساجد|الأئمة|تمور|صناعية|تخصيص|دعم السكني|إعاقة|اعاقة|الطفل|أحداث|مبلغين|جنسية|السجل المدني|الأحوال المدنية"

ADMIN_HINTS = r"الأساسي للحكم|مجلس الوزراء|مجلس الشورى|هيئة البيعة|ديوان المراقبة|إيرادات الدولة|المناطق|المنافسات والمشتريات|المنافسات و المشتريات|منافسات|مشتريات الحكومية|الوطنية|تنظيم هيئة|تنظيم اللجنة|الهيئة العامة"

def normalize(s):
    s = s or ""
    s = re.sub(r"[\u064B-\u0652]", "", s)  # تشكيل
    s = re.sub(r"[ًٌٍَُِّْـ]", "", s)
    s = s.replace("أ","ا").replace("إ","ا").replace("آ","ا")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def classify(name):
    n = normalize(name)
    for pat, dom in RULES:
        if re.search(normalize(pat), n):
            return dom
    if re.search(normalize(ADMIN_HINTS), n):
        return "admin"
    if re.search(normalize(REGULATORY_HINTS), n):
        return "regulatory"
    return "regulatory"  # افتراضي آمن: قطاعي تنظيمي (لا 'other' غامض)

# رموز المجالات (بادئة الرمز)
DOMAIN_PREFIX = {
    "civil":"CIV","commercial":"COM","companies":"CMP","labor":"LAB","criminal":"CRM",
    "procedure":"PRC","enforcement":"ENF","personal_status":"PST","arbitration":"ARB",
    "notarization":"NOT","evidence":"EVD","judiciary":"JUD","realestate":"RES","ip":"IPR",
    "tax_finance":"FIN","consumer":"CON","health":"HLT","admin":"ADM","regulatory":"REG",
}

def main():
    if not SRC.exists():
        print(f"❌ {SRC} غير موجود", file=sys.stderr); sys.exit(1)
    data = json.load(open(SRC, encoding="utf-8"))
    systems = data["systems"]

    # رتّب حسب عدد المواد (الأهم أولاً) لإسناد رموز مستقرة
    systems_sorted = sorted(systems, key=lambda s: -s.get("articleCount", 0))

    counters = {}
    out_systems = []
    domain_counts = {}
    for idx, s in enumerate(systems_sorted):
        name = s["name"]
        dom = classify(name)
        prefix = DOMAIN_PREFIX[dom]
        counters[prefix] = counters.get(prefix, 0) + 1
        code = f"{prefix}-{counters[prefix]:03d}"
        domain_counts[dom] = domain_counts.get(dom, 0) + 1
        out_systems.append({
            "code": code,
            "name": name,
            "domain": dom,
            "domainTitle": DOMAINS[dom],
            "articleCount": s.get("articleCount", 0),
            "order": idx + 1,
        })

    out = {
        "meta": {
            "source": "data/saudi_systems.json",
            "systemsCount": len(out_systems),
            "articlesCount": sum(s["articleCount"] for s in out_systems),
            "domains": DOMAINS,
            "note": "تصنيف وترميز معاد بناؤه بقواعد الاسم — لا يعتمد domain الآلي القديم.",
        },
        "systems": out_systems,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"✓ صُنّف ورُمّز {len(out_systems)} نظامًا / {out['meta']['articlesCount']} مادة → {OUT}")
    print("\n=== توزيع المجالات بعد التصنيف ===")
    for dom, cnt in sorted(domain_counts.items(), key=lambda x: -x[1]):
        print(f"  {cnt:>4}  {dom:<16} {DOMAINS[dom]}")

if __name__ == "__main__":
    main()
