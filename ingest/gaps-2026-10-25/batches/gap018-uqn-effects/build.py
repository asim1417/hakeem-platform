#!/usr/bin/env python3
"""gap018 (HKM-052، الصنف E1): ما لم ينعكس في حكيم من آثار أم القرى، بعد قراءة 47 أثرًا بقارئين مستقلين لكل نصف (v/w للنصف A، وx/y للنصف B).

النتيجة: أكثر الآثار منعكس. والمتفق عليه بين القارئين مما لم ينعكس أو انعكس معيبًا، ونصه مقروء حرفيًا من أم القرى:
  1. نظام المختبرات الخاصة م1 (م/31 لعام 1443): الفقرتان (أ) و(ب) ما زالتا بالتعريف القديم («الوزارة المختصة»، «الهيئة»)،
     والصواب «الجهة المختصة» و«المركز: المركز السعودي للاعتماد» (x، y).
  2. نظام المختبرات الخاصة م3: سقطت كلمة «طالب» من «بشرط التزام طالب الترخيص» (x، y).
  3. نظام الوزراء ونواب الوزراء م4 (م/56 لعام 1442): تصحيف «بلطب» صوابه «بطلب»، وسقط ترقيم البندين «1-» و«2-» (x، y).
  4. نظام تبادل المنافع م6 (م/118 لعام 1443): الفقرة (5) غائبة (x، y). والفقرة (6) غائبة أيضًا ولم يُقرأ نصها، فتبقى.
  5. نظام الآثار والمتاحف والتراث العمراني م71 (م/67 لعام 1442): سقطت كلمة «ريال» بعد «(خمسمائة ألف)» (v، w).
الإصلاح: نسخة نصية جديدة (unit_version) بالنص المصحح، تاريخها أول يوم نفاذ للأداة (النشر، ما اتفق عليه القارئان)، وهو بعد تاريخ آخر نسخة قائمة؛
والنص المصحح = النص الساري في حكيم مع التصحيح المحدد وحده (لا إعادة كتابة).
مؤجل: الرشوة م8 (الفقرة 6 من نظما وحده)، والمرور م23 وم27 (عبارة غير مؤكدة)، ومراقبة شركات التمويل م35 (ترقيم فقط)، وتواريخ النسخ السابقة (unit_version إضافة فقط).

    python3 batches/gap018-uqn-effects/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap018-uqn-effects-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


CUR = json.load(open(D / 'current_texts.json', encoding='utf-8'))
FIX = []


def fix(key, new_body, valid_from, instr, url, why, readers):
    c = CUR[key]
    assert new_body != c['cur'] and md5(c['cur']) == c['cur_md5'], key
    assert c['latest_vf'] is None or c['latest_vf'] < valid_from, key
    FIX.append(dict(key=key, article_id=c['id'], cur_md5=c['cur_md5'], from_uv=c['latest_id'], body=new_body, valid_from=valid_from,
                    ev=f"{instr} — من {valid_from}", url=url, quote=f"{why} [قارئان مستقلان متفقان ({readers})، HKM-052]"))


# 1) المختبرات م1
c = CUR['labs1']['cur']
i0 = c.index('أ - الوزارة المُختصة')
i1 = c.index('السياق.', i0) + len('السياق.')
A0 = c[i0:i1]  # نص الفقرة (أ) كما هو في حكيم
j0 = c.index('ب - الهيئة')
j1 = c.index('والمقاييس.', j0) + len('والمقاييس.')
B0 = c[j0:j1]
assert i1 < j0 and len(A0) < 400 and len(B0) < 80
A1 = ('أ- الجهة المختصة: وزارة التجارة، أو وزارة الصحة، أو وزارة البيئة والمياه والزراعة، أو وزارة الصناعة والثروة المعدنية، أو وزارة الشؤون البلدية والقروية والإسكان، '
      'أو الهيئة العامة للغذاء والدواء، أو غيرها من الجهات الحكومية التي تحددها اللائحة التنفيذية، وذلك بحسب ما يقتضيه النص أو السياق.')
B1 = 'ب- المركز: المركز السعودي للاعتماد.'
assert c.count(A0) == 1 and c.count(B0) == 1
fix('labs1', c.replace(A0, A1).replace(B0, B1), '2021-11-26', 'مرسوم ملكي رقم (م/31) وتاريخ 1443/4/6هـ', 'https://www.uqn.gov.sa/details?p=18603',
    'المرسوم الملكي (م/31) وتاريخ 1443/4/6هـ عدّل الفقرتين (أ) و(ب) من المادة الأولى: «أ- الجهة المختصة: …» و«ب- المركز: المركز السعودي للاعتماد»، '
    'وبقيتا في حكيم بالتعريف القديم مع أن المواد المعدلة تستعمل اللفظين الجديدين؛ النفاذ من النشر 1443/4/21هـ (م71 من النظام الأساسي)', 'x، y')
# 2) المختبرات م3
c = CUR['labs3']['cur']
assert c.count('بشرط التزام الترخيص') == 1
fix('labs3', c.replace('بشرط التزام الترخيص', 'بشرط التزام طالب الترخيص'), '2021-11-26', 'مرسوم ملكي رقم (م/31) وتاريخ 1443/4/6هـ', 'https://www.uqn.gov.sa/details?p=18603',
    'تصحيح نسخ: نص المرسوم (م/31) «بشرط التزام طالب الترخيص»، وسقطت من نسخة حكيم كلمة «طالب»', 'x، y')
# 3) الوزراء م4
c = CUR['min4']['cur']
P1 = 'ما يتصل بلطب التمتع بالإجازة'
P2 = 'ما يتصل بطلب التمتع بالإجازة لمن هم في مرتبة وزير أو المرتبة الممتازة من منسوبي أي جهاز مستقل'
assert c.count(P1) == 1 and c.count(P2) == 1
fix('min4', c.replace(P1, '1- ما يتصل بطلب التمتع بالإجازة').replace(P2, '2- ' + P2), '2021-03-05', 'مرسوم ملكي رقم (م/56) وتاريخ 1442/7/13هـ',
    'https://www.uqn.gov.sa/details?p=17018',
    'تصحيح نسخ: في نص المرسوم (م/56) «1- ما يتصل بطلب التمتع بالإجازة …» و«2- ما يتصل بطلب …»، وفي نسخة حكيم تصحيف «بلطب» وسقوط الترقيم', 'x، y')
# 4) تبادل المنافع م6
c = CUR['xch6']['cur']
P5 = 'في حالة تخصيص أي من المرافق العامة أو تحول منسوبيها من نظام إلى نظام آخر، فيلتزم صاحب العمل بسداد التكاليف الإضافية على النظامين'
assert P5 not in c and c.rstrip().endswith('مشفوعة بتوصياته.')
fix('xch6', c.rstrip() + ' 5 - ' + P5, '2022-06-24', 'مرسوم ملكي رقم (م/118) وتاريخ 1443/11/16هـ', 'https://www.uqn.gov.sa/details?p=19638',
    'المرسوم الملكي (م/118) وتاريخ 1443/11/16هـ: الفقرة (5) من المادة السادسة «في حالة تخصيص أي من المرافق العامة … على النظامين»، وهي غائبة من نص حكيم؛ '
    'النفاذ من النشر 1443/11/25هـ. والفقرة (6) غائبة أيضًا ولم يُقرأ نصها بعد', 'x، y')
# 5) الآثار م71
c = CUR['ath71']['cur']
P = 'ولا تزيد على (خمسمائة ألف)، أو بإحدى'
assert c.count(P) == 1
fix('ath71', c.replace(P, 'ولا تزيد على (خمسمائة ألف) ريال، أو بإحدى'), '2021-04-02', 'مرسوم ملكي رقم (م/67) وتاريخ 1442/8/12هـ', 'https://www.uqn.gov.sa/details?p=17316',
    'تصحيح نسخ: نص المرسوم (م/67) في أم القرى «ولا تزيد على (خمسمائة ألف) ريال»، وسقطت «ريال» من النسخة المنقولة من ملاحظة هيئة الخبراء؛ النفاذ من النشر 1442/8/20هـ', 'v، w')

g = []
for f in FIX:
    aid = lit(f['article_id'])
    cur_expr = (f"(SELECT md5(body) FROM unit_version WHERE unit_id={aid} ORDER BY valid_from DESC, id DESC LIMIT 1)" if f['from_uv']
                else f"(SELECT md5(content) FROM legal_articles WHERE id={aid})")
    g.append(f"{cur_expr}={lit(f['cur_md5'])}")
    g.append(f"(SELECT count(*) FROM unit_version WHERE unit_id={aid} AND valid_from::date >= {lit(f['valid_from'])}::date)=0")
st = [f"SELECT CASE WHEN {' AND '.join(g)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'g18u-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append("INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ',\n'.join(
    f"({lit('g18u-' + h(BY, f['article_id'], f['valid_from']))}, {lit(f['article_id'])}, {lit(f['body'])}, {lit(f['valid_from'])}::timestamptz, {lit(f['ev'])}, {lit(f['url'])}, {lit(f['quote'])}, now())" for f in FIX))
fp = md5('|'.join(f"{f['article_id']}:{f['valid_from']}:{hashlib.sha256(f['body'].encode()).hexdigest()}" for f in sorted(FIX, key=lambda f: f['article_id'])))
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'g18u-%')={len(FIX)} AND (SELECT md5(string_agg(unit_id||':'||valid_from::date||':'||encode(sha256(convert_to(body,'UTF8')),'hex'), '|' ORDER BY unit_id)) FROM unit_version WHERE id LIKE 'g18u-%')={lit(fp)} THEN 'ok' ELSE {FAIL} END AS guard_after")
m = md5('\n'.join(st))
json.dump({'by': BY, 'md5': m, 'count': len(st), 'expect_delta': {}, 'report': {'versions': len(FIX), 'new_articles': 0, 'changed_text': len(FIX),
           'plan': [dict(key=f['key'], valid_from=f['valid_from'], ev=f['ev']) for f in FIX]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(m, len(st), 'versions', len(FIX))
