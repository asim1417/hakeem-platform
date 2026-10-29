#!/usr/bin/env python3
"""gap019j (HKM-052، M2b): تواريخ النفاذ الملتبسة بترتيب المصادر الذي قرره المالك 29/10:
«إذا التبس لديك أي تواريخ رسمية ارجع لأداة كروم وافتح موقع هيئة الخبراء، فإن لم تجده فالمركز الوطني للوثائق والمحفوظات، فإن لم تجده فأم القرى، فإن لم تجده فنظما».

1. هيئة الخبراء (فُتحت صفحاتها في كروم 29/10 فطابق تاريخ النشر فيها ما في اللقطة): 13 نظامًا تاريخ نشرها حقيقي في الهيئة،
   فيُعتمد ولو خالفه نظما أو قارئ. والمدة من نص النظام (وعبارة نظام المشاركة بالوقت قُرئت من صفحة الهيئة نفسها: «ويعمل به بعد تسعين يومًا من تاريخ نشره»).
   «سنة» في نصين قبل 1438هـ (الأحوال المدنية 1407، ومكافحة التدخين 1436) سنة هجرية، كما اختار القارئان.
2. ما تاريخه في الهيئة نائب (1440/03/21): المركز الوطني للوثائق فُتح في كروم ولم يستجب بحثه للأداة، وأعداد أم القرى قبل 1433هـ غير مفهرسة،
   فالمرجع نظما: تنظيم مجمع الملك عبدالعزيز للمكتبات الوقفية (1437/10/03)، ولائحة دور الرعاية الاجتماعية (1434/10/23)، ولائحة ضوابط دخول القوارب (1409/10/14).
مؤجل: نظام الشركات (اصطلاح العد بيد المالك)، ولائحتا إنشاء الطرق من الأهالي والمدارس الأجنبية (لا تاريخ نشر في أي مصدر).
التاريخ = النشر (هجري، تقويم أم القرى) + المدة، قاعدة HKM-024. الكتابة محروسة بالقيمة القديمة.
"""
import hashlib, json, datetime, re, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
BY = 'gap019j-source-hierarchy-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
P = {x['item']: x for x in json.load(open(D.parent / 'gap019-effective-corrections' / 'held_packet.json', encoding='utf-8'))['items']}
L = {x['system_id']: x for x in (json.loads(l) for l in open(D.parents[1] / 'ledger' / '2026-10-29' / 'ledger.jsonl', encoding='utf-8')) if x['gap'] == 'M2b'}
# (البند، المدة بالأيام أو 'year'، مصدر النشر)
ROWS = [('EH-04', 'year', 'boe'), ('EH-05', 90, 'boe'), ('EH-06', 120, 'boe'), ('EH-08', 90, 'boe'), ('EH-10', 90, 'boe'), ('EH-11', 120, 'boe'),
        ('EH-12', 90, 'boe'), ('EH-13', 90, 'boe'), ('EH-14', 'year', 'boe'), ('EH-15', 120, 'boe'), ('EH-17', 60, 'boe'), ('EH-21', 60, 'boe'),
        ('EH-26', 30, 'boe'), ('EH-22', 90, 'nezams'), ('EH-29', 90, 'nezams'), ('EH-30', 90, 'nezams')]


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


ok = []
for item, n, src in ROWS:
    p = P[item]
    pub = p['boe_published_hijri'] if src == 'boe' else p['nezams_published_hijri']
    assert pub and not (src == 'boe' and pub.startswith('1440/03/21')), item
    y, m, d = map(int, re.split(r'[-/]', pub)[:3])
    if n == 'year':
        eff = Hijri(y + 1, m, d).to_gregorian().isoformat()
        rule = 'سنة هجرية'
    else:
        eff = (Hijri(y, m, d).to_gregorian() + datetime.timedelta(days=n)).isoformat()
        rule = f'{n} يومًا'
    assert p['stored_effective'] and eff > p['stored_effective'], item
    clause = p['clause'] if item != 'EH-10' else '6– ينشر هذا النظام في الجريدة الرسمية، ويعمل به بعد تسعين يومًا من تاريخ نشره.'  # من صفحة الهيئة
    ok.append(dict(item=item, sid=p['system_id'], name=p['name'], old=p['stored_effective'], new=eff, pub=pub, rule=rule, src=src, url=L[p['system_id']]['ref'] if src == 'boe' else 'nezams.com', clause=clause))
SRC = {'boe': 'بطاقة هيئة الخبراء (فُتحت في كروم 29/10)', 'nezams': 'نظما (تاريخ الهيئة نائب، وبحث المركز الوطني للوثائق لم يستجب، وأم القرى لا تفهرس العدد)'}
st = [f"SELECT CASE WHEN {' AND '.join('(SELECT preamble_effective_from::date FROM legal_systems WHERE id=' + lit(r['sid']) + ')=' + lit(r['old']) + '::date' for r in ok)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19jp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for r in ok:
    note = (f"HKM-052 {BY}: عبارة النفاذ: «{r['clause'].strip()}» — النشر {r['pub']}هـ ({SRC[r['src']]}) + {r['rule']} = {r['new']}؛ وكان المخزن {r['old']} (تاريخ الصدور) "
            f"[ترتيب المصادر بقرار المالك 29/10]")
    pid = 'g19jp-' + h(BY, r['sid'])
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(r['sid'])}, {lit(r['name'])}, NULL, {lit(r['src'])}, {lit(BY)}, {lit(r['url'])}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_corrected:' + r['old'] + '->' + r['new'])}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for r in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from::date = {lit(r['old'])}::date")
st.append(f"SELECT CASE WHEN {' AND '.join('(SELECT preamble_effective_from::date FROM legal_systems WHERE id=' + lit(r['sid']) + ')=' + lit(r['new']) + '::date' for r in ok)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19jp-%')={len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': len(ok), 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(item=r['item'], name=r['name'], old=r['old'], new=r['new'], src=r['src']) for r in ok]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'corrected', len(ok))
for r in ok: print(r['item'], r['name'][:38], r['pub'], r['rule'], r['old'], '->', r['new'], r['src'])
