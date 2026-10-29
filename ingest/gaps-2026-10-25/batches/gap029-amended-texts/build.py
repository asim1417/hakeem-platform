#!/usr/bin/env python3
"""gap029 (HKM-052، الصنف U3، الطبقة الثالثة): نسخ نصية لمواد معدّلة يعرض حكيم نصها الأصلي، من ملاحظات تعديل الهيئة.
بأمر المالك 29/10 23:58 «اي تاريخ نفاذ اجلبه من المواقع الرسمية واكمل شي».

المدخل: selection.json من select.py — مواد كل ملاحظاتها «تعديل مادة كاملة» بنص كامل، ولكل ملاحظة أداة معيّنة (من الملاحظة، أو اتفق عليها قارئان)
وتاريخ نفاذ اتفق عليه قارئان مستقلان (gap016/gap016b، أو amend_dates_c: c1/c2، c3/c4) بقاعدة HKM-024.
مستبعد: نظام القضاء (ملاحظات مسندة لغير موادها)، والخدمة المدنية م37 وضريبة الدخل م67 (كما في gap016b)، ورسوم الأراضي البيضاء (BD-34).
الكتابة: unit_version فقط (إضافة)، والنص الأصلي في legal_articles لا يُمس.
"""
import hashlib, json, re
from pathlib import Path
D = Path(__file__).parent
BY = 'gap029-amended-texts-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
KIND = {'royal_decree': 'مرسوم ملكي', 'cabinet_decision': 'قرار مجلس الوزراء', 'royal_order': 'أمر ملكي'}
DEAD = "('ملغاة','ملغى','مستبدل')"


def clean(t):
    t = re.split(r'["”]\s*\.?\s*(?:وذلك بموجب|-\s*أُ?ضيفت)', t.strip())[0]
    t = t.strip().strip('"“”').strip()
    assert not re.search(r'وذلك بموجب (المرسوم|الأمر|قرار)', t) and 'ضيفت مادة يكون ترتيبها' not in t and '•' not in t, t[-200:]
    return t


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


S = json.load(open(D / 'selection.json', encoding='utf-8'))
rows = []
for a in S['selected']:
    for z in sorted(a['notes'], key=lambda z: z['nseq']):
        body = clean(z['new'])
        assert body and '...' not in body, (a['law'], a['n'])
        kind, no, dh = z['instr'].split(' ', 2)
        ev = f"{KIND[kind]} رقم ({no}) وتاريخ {dh}هـ — من {z['date']}"
        q = f"ملاحظة هيئة الخبراء على المادة: «{z['note'].strip()[:900]}»؛ النفاذ: {z['ev']} ← {z['date']} [HKM-052 {BY}]"
        rows.append(dict(article_id=a['article_id'], system_id=a['system_id'], law=a['law'], n=a['n'], bis=a['bis'], md5=a['md5'], note_id=z['note_id'],
                         body=body, valid_from=z['date'], ev=ev, quote=q, uid='g29u-' + h(BY, a['article_id'], z['note_id'], z['date'])))
g, seen = [], set()
for r_ in rows:
    aid = lit(r_['article_id'])
    if r_['article_id'] not in seen:
        seen.add(r_['article_id'])
        g += [f"(SELECT count(*) FROM legal_articles WHERE id={aid} AND \"legalSystemId\"={lit(r_['system_id'])} AND \"articleNumber\"={int(r_['n'])} AND \"articleBis\"={int(r_['bis'])} AND md5(content)={lit(r_['md5'])})=1",
              f"(SELECT count(*) FROM unit_version WHERE unit_id={aid})=0",
              f"coalesce((SELECT verified_status FROM verification WHERE object_type='unit' AND object_id={aid} ORDER BY verified_at DESC, id DESC LIMIT 1),'') NOT IN {DEAD}",
              f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(r_['system_id'])} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'"]
    g.append(f"(SELECT count(*) FROM boe.amendment_note WHERE id={lit(r_['note_id'])} AND position({lit(r_['body'])} in new_text)>0)=1")
st = [f"SELECT CASE WHEN {' AND '.join(g)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'g29u-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append("INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ',\n'.join(
    f"({lit(r_['uid'])}, {lit(r_['article_id'])}, {lit(r_['body'])}, {lit(r_['valid_from'])}::timestamptz, {lit(r_['ev'])}, {lit('boe.amendment_note:' + r_['note_id'])}, {lit(r_['quote'])}, now())" for r_ in rows))
fp = hashlib.md5('|'.join(f"{r_['article_id']}:{r_['valid_from']}:{hashlib.sha256(r_['body'].encode()).hexdigest()}" for r_ in sorted(rows, key=lambda r_: (r_['article_id'], r_['valid_from']))).encode()).hexdigest()
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'g29u-%')={len(rows)} AND (SELECT md5(string_agg(unit_id||':'||valid_from::date||':'||encode(sha256(convert_to(body,'UTF8')),'hex'), '|' ORDER BY unit_id, valid_from)) FROM unit_version WHERE id LIKE 'g29u-%')={lit(fp)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {},
           'report': {'versions': len(rows), 'articles': len(seen), 'new_articles': 0, 'changed_text': len(seen), 'skipped': S['skipped'],
                      'plan': [dict(law=r_['law'], n=r_['n'], valid_from=r_['valid_from'], instr=r_['ev']) for r_ in rows]},
           'statements': st, 'diag_guards': g}, open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'versions', len(rows), 'articles', len(seen))
for r_ in rows:
    print(r_['law'], 'م', r_['n'], r_['valid_from'], '|', r_['body'][:110])
