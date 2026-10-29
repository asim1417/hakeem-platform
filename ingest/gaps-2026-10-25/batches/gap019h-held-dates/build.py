#!/usr/bin/env python3
"""gap019h (HKM-052، الصنف M2b، المعلّق من gap019): تصحيح تاريخ نفاذ مخزن بتاريخ الصدور، مما اتفق عليه قارئان مستقلان (h1، h2) من أم القرى.

يُكتب البند إذا اتفق القارئان على أول يوم نفاذ (النشر + المدة، HKM-024) وكان التاريخ المخزن هو القيمة القديمة نفسها.
ما لم يتفقا عليه يبقى: 23 بندًا من EH-01..EH-30 (نفدت ميزانية البحث عند أحدهما، أو اختلفا يومًا في الخيل العربية والذوق العام)،
وبنود S: نظام العمل م231 (المرسوم م/46: «بعد (ستة) أشهر» ← 2015-10-18 باتفاقهما، لكن الملاحظة «تعديل ونقل» وفي النص المقترح عنوان المادة، فيُؤجل)،
ورسوم الأراضي البيضاء (حللها قارئ واحد مادةً مادة)، والمدن الاقتصادية أ/240 (قارئ واحد)، ولائحة الأراضي 1437 (لا نص إحلال صريح)،
وقسمة الأموال المشتركة (الأداة القائمة قرار وزير العدل 1610 لعام 1439هـ، ولا أداة جديدة)، والجدول الزمني للوائح الطيران (غير منشور).
تفويض المالك 29/10: «نفذ كل شيء… ولا تنتظر موافقتي».

    python3 batches/gap019h-held-dates/build.py
"""
import hashlib, json, warnings
from pathlib import Path
warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'held'
BY = 'gap019h-held-dates-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def g(d):
    if not d:
        return None
    if int(d[:4]) < 1700:
        y, m, dd = map(int, d.split('-'))
        return Hijri(y, m, dd).to_gregorian().isoformat()
    return d


A = {json.loads(l)['item']: json.loads(l) for l in open(R / 'reader_h1.jsonl', encoding='utf-8') if l.strip()}
B = {json.loads(l)['item']: json.loads(l) for l in open(R / 'reader_h2.jsonl', encoding='utf-8') if l.strip()}
P = {x['item']: x for x in json.load(open(D.parent / 'gap019-effective-corrections' / 'held_packet.json', encoding='utf-8'))['items']}
ok = []
for k, p in P.items():
    if k.startswith('EH-S'):
        continue
    a, b = A.get(k, {}), B.get(k, {})
    ea, eb = g(a.get('effective_from')), g(b.get('effective_from'))
    if ea and ea == eb and p.get('stored_effective') and ea != p['stored_effective']:
        ok.append(dict(item=k, sid=p['system_id'], name=p['name'], old=p['stored_effective'], new=ea, pub=a.get('published_hijri'), url=a.get('pub_source') or b.get('pub_source') or '',
                       clause=p['clause'], days=a.get('days')))
st = [f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[chr(115)+chr(105)+chr(100)])})={lit(r[chr(111)+chr(108)+chr(100)])}::date' for r in ok)}"
      f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19hp-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
for r in ok:
    note = (f"HKM-052 {BY}: عبارة النفاذ: «{r['clause'].strip()}» — النشر {r['pub']}هـ (أم القرى) + {r['days']} يومًا = {r['new']}؛ وكان المخزن {r['old']} (تاريخ الصدور) "
            f"[قارئان مستقلان متفقان (h1، h2)]")
    pid = 'g19hp-' + h(BY, r['sid'])
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(r['sid'])}, {lit(r['name'])}, NULL, 'uqn', {lit(BY)}, {lit(r['url'].split(' ')[0])}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', "
              f"{lit('effective_from_corrected:' + r['old'] + '->' + r['new'])}, {lit(note)} WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for r in ok:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(r['new'])}::timestamptz WHERE id = {lit(r['sid'])} AND preamble_effective_from::date = {lit(r['old'])}::date")
st.append(f"SELECT CASE WHEN {' AND '.join(f'(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[chr(115)+chr(105)+chr(100)])})={lit(r[chr(110)+chr(101)+chr(119)])}::date' for r in ok)}"
          f" AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g19hp-%')={len(ok)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'corrected': len(ok), 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(item=r['item'], name=r['name'], old=r['old'], new=r['new']) for r in ok]}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'corrected', len(ok))
for r in ok: print(r['item'], r['name'][:40], r['old'], '->', r['new'], r['url'][:60])
