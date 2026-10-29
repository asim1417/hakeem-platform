#!/usr/bin/env python3
"""gap015b (HKM-052، الصنف M3، الجولة الثانية): تصنيف 30 أداة بقيت «غير محسوم» في gap015، بنصها الكامل وقارئين جديدين i وj.

يُكتب ما اتفق عليه القارئان المستقلان i وj حرفًا (readers/readings/m3b/)، أو ما حسمه المراجع الثالث (review_i.jsonl إن وُجد).
التصنيف من السبعة عشر في M3_RULES.md وحدها. «غير محسوم» لا يُكتب.
الكتابة: UPDATE legal_systems SET classification … WHERE … AND coalesce(classification,'')='' (المسموح في apply-statements بـ --allow-guarded-update)،
بشرطي ما قبل (كل الأهداف فارغة التصنيف) وما بعد (كلها بالتصنيف المقرر). لا يمس المواد ولا النصوص.

    python3 batches/gap015b-classification/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'm3b'
BY = 'gap015b-classification-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
ALLOWED = {'أنظمة التجارة والاقتصاد والاستثمار', 'أنظمة الخدمات البلدية والتخطيط والتطوير الحضري', 'أنظمة المواصلات والاتصالات',
           'أنظمة الزراعة والمياه والثروات الحية', 'أنظمة الطاقة والصناعة والتعدين', 'أنظمة الأمن الداخلي والأحوال المدنية والأنظمة الجنائية',
           'أنظمة العمل والرعاية الاجتماعية', 'أنظمة السياحة والآثار', 'أنظمة المال والرقابة', 'أنظمة الصحة', 'أنظمة السلطة القضائية وحقوق الإنسان',
           'أنظمة الإعلام والثقافة والنشر', 'أنظمة التعليم والعلوم', 'أنظمة الشباب والرياضة', 'أنظمة الخدمة المدنية', 'أنظمة الحج والشؤون الإسلامية',
           'أنظمة التشريفات والمراسم والسلك الدبلوماسي'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def load(p):
    return {x['item']: x for x in (json.loads(l) for l in open(p, encoding='utf-8') if l.strip())} if p.exists() else {}


items = json.load(open(D / 'packets.json', encoding='utf-8'))['items']
g, h, rv = load(R / 'reader_i.jsonl'), load(R / 'reader_j.jsonl'), load(R / 'review_k.jsonl')
decided, open_items = {}, []
for it in items:
    k, a, b = it['item'], (g.get(it['item']) or {}), (h.get(it['item']) or {})
    assert a.get('id') in (None, it['id']) and b.get('id') in (None, it['id']), k
    ca, cb = a.get('classification'), b.get('classification')
    if ca == cb and ca in ALLOWED:
        decided[it['id']] = (ca, 'agreed')
    elif k in rv and rv[k].get('classification') in ALLOWED:
        decided[it['id']] = (rv[k]['classification'], 'reviewed')
    else:
        open_items.append({'item': k, 'id': it['id'], 'name': it['name'], 'i': ca, 'j': cb, 'review': (rv.get(k) or {}).get('classification')})
ids = sorted(decided)
st = [f"SELECT CASE WHEN (SELECT count(*) FROM legal_systems WHERE id IN ({','.join(lit(i) for i in ids)}) AND coalesce(classification,'')='')={len(ids)} THEN 'ok' ELSE {FAIL} END AS guard_before"]
st += [f"UPDATE legal_systems SET classification = {lit(decided[i][0])} WHERE id = {lit(i)} AND coalesce(classification, '') = ''" for i in ids]
fp = hashlib.md5('|'.join(f'{i}:{decided[i][0]}' for i in ids).encode()).hexdigest()
st.append(f"SELECT CASE WHEN (SELECT md5(string_agg(id||':'||classification, '|' ORDER BY id)) FROM legal_systems WHERE id IN ({','.join(lit(i) for i in ids)}))={lit(fp)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
by_cls = {}
for c, _ in decided.values():
    by_cls[c] = by_cls.get(c, 0) + 1
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'updated': len(ids), 'agreed': sum(1 for v in decided.values() if v[1] == 'agreed'),
           'reviewed': sum(1 for v in decided.values() if v[1] == 'reviewed'), 'open': len(open_items), 'by_class': by_cls, 'new_articles': 0, 'changed_text': 0},
           'statements': st}, open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(open_items, open(D / 'open_items.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'updated', len(ids), 'open', len(open_items))
