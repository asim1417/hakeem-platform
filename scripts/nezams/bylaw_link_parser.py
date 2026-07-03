# -*- coding: utf-8 -*-
"""
محلّل ربط اللائحة بالنظام لمنصة حكيم
يستخرج من نص مواد اللائحة الإشاراتِ الصريحة إلى مواد النظام
(مثل: "المادة (السادسة) من النظام") ويحوّلها إلى علاقات قابلة للاستعلام.
"""
import re
import json
import csv

# ---------------------------------------------------------------------------
# 1) تطبيع النص العربي (توحيد الهمزات والألف المقصورة وحذف التطويل والتشكيل)
# ---------------------------------------------------------------------------
_HARAKAT = re.compile(r'[\u0617-\u061A\u064B-\u0652\u0640]')  # تشكيل + تطويل

def normalize(s: str) -> str:
    s = _HARAKAT.sub('', s)
    s = (s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
           .replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي'))
    return s.strip()

# ---------------------------------------------------------------------------
# 2) قاموس الأعداد الترتيبية المؤنّثة (لأن "المادة" مؤنّثة)
#    الطريقة جمعية: نجزّئ العبارة إلى وحدات ونجمع قيمها، ونتجاهل الروابط.
# ---------------------------------------------------------------------------
_ORDINAL = {
    # آحاد
    'اولي': 1, 'حادية': 1, 'واحدة': 1,
    'ثانية': 2, 'ثالثة': 3, 'رابعة': 4, 'خامسة': 5,
    'سادسة': 6, 'سابعة': 7, 'ثامنة': 8, 'تاسعة': 9,
    # عشرات
    'عاشرة': 10, 'عشرة': 10, 'عشر': 10,
    'عشرون': 20, 'عشرين': 20, 'ثلاثون': 30, 'ثلاثين': 30,
    'اربعون': 40, 'اربعين': 40, 'خمسون': 50, 'خمسين': 50,
    'ستون': 60, 'ستين': 60, 'سبعون': 70, 'سبعين': 70,
    'ثمانون': 80, 'ثمانين': 80, 'تسعون': 90, 'تسعين': 90,
    # مئات
    'مائة': 100, 'مئة': 100, 'مائتان': 200, 'مئتان': 200,
    'مائتين': 200, 'مئتين': 200,
    'ثلاثمائة': 300, 'ثلاثمئة': 300, 'اربعمائة': 400, 'اربعمئة': 400,
    'خمسمائة': 500, 'خمسمئة': 500, 'ستمائة': 600, 'سبعمائة': 700,
    'ثمانمائة': 800, 'تسعمائة': 900,
}
# نطبّع مفاتيح القاموس بنفس دالة التطبيع (مهم: "مائة" تصبح "ماية" بعد التطبيع)
_ORDINAL = {normalize(k): v for k, v in _ORDINAL.items()}

# كلمات رابطة تُتجاهَل في الجمع
_SKIP = {'و', 'بعد', 'من', 'ال', 'المادة', 'الماده', ''}

_AR_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

def parse_ordinal(phrase: str):
    """يحوّل عبارة ترتيبية عربية أو رقماً إلى عدد صحيح، أو None."""
    phrase = normalize(phrase).translate(_AR_DIGITS)
    # حالة الرقم المكتوب رقماً: (6) أو (٦)
    m = re.search(r'\d+', phrase)
    if m and not re.search(r'[\u0600-\u06FF]', re.sub(r'\d', '', phrase)):
        return int(m.group())
    total = 0
    found = False
    for tok in re.split(r'[\s\u0640]+', phrase):
        tok = tok.strip()
        # إزالة "ال" التعريف و"و" العطف من بداية الوحدة
        tok = re.sub(r'^و?ال', '', tok)
        tok = re.sub(r'^و', '', tok)
        if tok in _SKIP:
            continue
        if tok in _ORDINAL:
            total += _ORDINAL[tok]
            found = True
    return total if found and total > 0 else None

# ---------------------------------------------------------------------------
# 3) استخراج الإشارات من نص مادة اللائحة
#    نلتقط: المادة/المادتين + عبارة ترتيبية (+ عبارة ثانية) + "من (هذا) النظام"
# ---------------------------------------------------------------------------
_REF = re.compile(
    r'الماد(?:ة|ه|تين|تي)\s*'
    r'\(?\s*([^)\n]{2,45}?)\s*\)?'                      # الترتيبية الأولى
    r'(?:\s*و\s*\(?\s*([^)\n]{2,45}?)\s*\)?)?'          # ترتيبية ثانية (المادتين .. و ..)
    r'\s*من\s+(?:هذا\s+)?النظام',
    re.UNICODE,
)

def extract_refs(text: str):
    """يرجّع قائمة أرقام مواد النظام المُشار إليها صراحةً داخل نص المادة."""
    out = []
    for g1, g2 in _REF.findall(text):
        for g in (g1, g2):
            if not g:
                continue
            n = parse_ordinal(g)
            if n:
                out.append((n, g.strip()))
    # إزالة التكرار مع الحفاظ على الترتيب
    seen, uniq = set(), []
    for n, ev in out:
        if n not in seen:
            seen.add(n); uniq.append((n, ev))
    return uniq

# ---------------------------------------------------------------------------
# 4) بناء الروابط
#    المدخلات:
#      bylaw_articles : [{id, law_id, number, text}]  مواد اللوائح
#      implements_map : {bylaw_law_id: system_law_id}  من طبقة IMPLEMENTS عندك
#      system_index   : {(system_law_id, article_number): system_article_id}
# ---------------------------------------------------------------------------
def build_links(bylaw_articles, implements_map, system_index):
    links, unresolved = [], []
    for ba in bylaw_articles:
        sys_law = implements_map.get(ba['law_id'])
        for num, evidence in extract_refs(ba['text']):
            if sys_law is None:
                unresolved.append({'bylaw_article_id': ba['id'],
                                   'reason': 'no_implements_mapping',
                                   'sys_article_number': num})
                continue
            sys_art_id = system_index.get((sys_law, num))
            if sys_art_id is None:
                unresolved.append({'bylaw_article_id': ba['id'],
                                   'reason': 'article_number_not_found',
                                   'system_law_id': sys_law,
                                   'sys_article_number': num})
                continue
            links.append({
                'bylawArticleId':  ba['id'],
                'systemArticleId': sys_art_id,
                'linkType':        'IMPLEMENTS',
                'evidence':        f'المادة ({evidence}) من النظام',
                'confidence':      0.95,
                'source':          'AUTO',
            })
    return links, unresolved

# ---------------------------------------------------------------------------
# اختبار ذاتي
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    tests = {
        'الأولى': 1, 'السادسة': 6, 'التاسعة': 9, 'العاشرة': 10,
        'الحادية عشرة': 11, 'الثانية عشرة': 12, 'التاسعة عشرة': 19,
        'العشرون': 20, 'الحادية والعشرون': 21, 'الخامسة والعشرون': 25,
        'الثلاثون': 30, 'الرابعة والثلاثون': 34, 'المائة': 100,
        'الحادية بعد المائة': 101, 'الثانية والعشرون بعد المائة': 122,
        '(6)': 6, '(٦)': 6, 'المائتان': 200, 'الحادية بعد المائتين': 201,
    }
    ok = True
    for phrase, expected in tests.items():
        got = parse_ordinal(phrase)
        flag = '✓' if got == expected else '✗'
        if got != expected: ok = False
        print(f'  {flag}  {phrase:35s} → {got}  (expected {expected})')
    print('\nكل اختبارات الأرقام نجحت' if ok else '\n⚠️ فيه اختبارات فشلت')

    # اختبار الاستخراج من نص لائحة واقعي
    sample = ('يجب على الجهة المختصة وفقاً للحكم الوارد في المادة (السادسة) '
              'من النظام أن تتخذ الإجراءات، مع مراعاة المادتين (التاسعة) '
              'و(العاشرة) من النظام.')
    print('\nالإشارات المستخرجة:', extract_refs(sample))
