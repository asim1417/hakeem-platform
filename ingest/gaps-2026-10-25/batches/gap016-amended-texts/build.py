#!/usr/bin/env python3
"""gap016 (HKM-052، الصنف U3): نسخ نصية للمواد المعدّلة التي يعرض حكيم نصها الأصلي، من ملاحظة تعديل الهيئة، على نمط HKM-030.

الدفعة التجريبية: ما اجتمعت فيه الشروط كلها (pilot.json):
  - ملاحظة واحدة على المادة في لقطة الهيئة، نوعها «تعديل مادة كاملة» (amend_article) بلا حاجة مراجعة، ومعها النص الجديد كاملًا؛
  - لا نقل ولا ترتيب ولا دمج ولا «...» في النص الجديد؛ ونص حكيم = نص الهيئة الأصلي (U3 shows_original)؛
  - المادة بلا نسخة نصية سابقة، وبلا حالة، ونظامها «ساري».
تاريخ النسخة: أول يوم نفاذ للأداة المعدِّلة، مما اتفق عليه قارئان مستقلان (readers/readings/amend_dates/ m وn) بقاعدة HKM-024
(النشر + N يومًا، والسكوت ← م71 من النظام الأساسي: من تاريخ النشر). ما لم يتفق عليه القارئان لا يُكتب.
الكتابة: unit_version فقط (إضافة)، والنص الأصلي في legal_articles لا يُمس.

    python3 batches/gap016-amended-texts/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'amend_dates'
BY = 'gap016-amended-texts-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
KIND = {'royal_decree': 'مرسوم ملكي', 'cabinet_decision': 'قرار مجلس الوزراء', 'royal_order': 'أمر ملكي'}
EXCLUDE = {('تنظيم الهيئة العامة للعقار', 13)}  # الصف في حكيم مكرر (articleBis=1)؛ يُستبعد حتى تُحسم الهوية
MD5 = {  # md5(content) في حكيم وقت البناء (قراءة 29/10)
    'cmpz6nqhz0av7cwg23lzeas83': 'fe2b45198fe783b5697876cee14e3102', 'cmpz61os203b3cwg2eoejgrny': 'c70fa8b7f01facf339bffd0afad20440',
    'cmpz5ufsi00vpcwg2pvty3sqs': '7625c1ee279b34ec8a9c693f4e9d18dc', 'cmpzcv6wo0aauvtrkt0cuck1k': '2e9814700f6b8f5647bdcbdf821830ac',
    'cmpz62fky03jhcwg2nzvjb5r8': 'e91957b20a3492a8281d16e510237008', 'cmpz62i2b03kbcwg2riohl8nl': '9aa6f078cf9e118fd3408d067f2ccd0d',
    'cmpz62ik603khcwg2ewwhdqnq': 'bb4ca3774f1a8caeef3c47f61114e9e7', 'cmpz62iw403klcwg20oy07wfs': 'efce48b42b0a08e23ec34940f4525f68',
    'cmpz62j8303kpcwg2rv4kznqo': '5a4621d9c5b09881c94fd922d6b4553a', 'cmpz62k7u03l1cwg2hcyj0v97': '56e1cc363b439fb85eaf55dfc59ddcb5',
    'cmpzcvahb0bbbvtrk5nslenyq': '92c9166ed07e9735c25c1739e029bd11', 'cmpz64k2r048lcwg2u2qso90x': '7f3b490a27965391266679362261353a',
    'cmpz6lkc30a45cwg2j305mzdc': '7fbd6d47e7ff0da28b2ff2361c43cd1a', 'cmpz6lkhs0a47cwg2dfw2dxmc': 'ea222789bf8f4a07671755789ba19976',
    'cmpz6lkng0a49cwg2as6mvqo1': '3f433c2069b4a84b745f4299d3ad336a', 'cmpz6ll4j0a4fcwg22crtlq3l': '3b631649744eb79b17b3299ee91971a3',
    'cmpz6lla80a4hcwg2jvb0wn3a': 'c71ab05ba4a74c0243e45ee0f3a284e3', 'cmpz6lllk0a4lcwg2wuc4a48u': 'e900e2fda0e0b6fff37a4438a9e891fc',
    'cmpz6lm2v0a4rcwg2998dxy9r': 'ff5700de983176b6686a97e1cd25f047', 'cmpz6gg43089hcwg2co2nci48': 'a77d8bb6d3848fad32b66ded7723e90f',
}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def load(p):
    return {x['item']: x for x in (json.loads(l) for l in open(p, encoding='utf-8') if l.strip())} if p.exists() else {}


pilot = json.load(open(D / 'pilot.json', encoding='utf-8'))
dp = {x['instrument']: x['item'] for x in json.load(open(D / 'date_packets.json', encoding='utf-8'))['items']}
m, n = load(R / 'reader_m.jsonl'), load(R / 'reader_n.jsonl')
dates, open_dates = {}, {}
for ins, item in dp.items():
    a, b = m.get(item) or {}, n.get(item) or {}
    if a.get('date') and a.get('date') == b.get('date'):
        dates[ins] = a
    else:
        open_dates[ins] = {'m': a.get('date'), 'n': b.get('date')}
rows, skipped = [], []
for p in pilot:
    if (p['law'], p['n']) in EXCLUDE:
        skipped.append({'item': p['item'], 'why': 'excluded'}); continue
    d = dates.get(p['instr'])
    if not d:
        skipped.append({'item': p['item'], 'why': 'date_not_agreed', 'instr': p['instr']}); continue
    body = p['new'].strip()
    assert body and '...' not in body and not body.startswith('"'), p['item']
    kind, no, dh = p['instr'].split(' ', 2)
    y = re.findall(r'\d+', dh)
    ymd = f'{y[0]}/{y[1]}/{y[2]}' if len(y[0]) == 4 else f'{y[2]}/{y[1]}/{y[0]}'
    ev_instr = f"{KIND[kind]} رقم ({no}) وتاريخ {ymd}هـ — من {d['date']}"
    quote = (f"ملاحظة هيئة الخبراء على المادة: «{p['note'].strip()}»؛ النفاذ: {d['rule']} (النشر {d.get('published_hijri')}هـ، {d.get('pub_source')}) "
             f"← {d['date']} [قارئان مستقلان متفقان، HKM-052]")
    rows.append(dict(p, body=body, valid_from=d['date'], ev_instr=ev_instr, ev_url=d.get('pub_source') or p['url'], quote=quote,
                     uid='g16u-' + h(BY, p['article_id'], d['date'])))
DEAD = "('ملغاة','ملغى','مستبدل')"
g = []
for r in rows:
    aid = lit(r['article_id'])
    g += [f"(SELECT count(*) FROM legal_articles WHERE id={aid} AND \"legalSystemId\"={lit(r['system_id'])} AND \"articleNumber\"={int(r['n'])} AND \"articleBis\"=0 AND md5(content)={lit(MD5[r['article_id']])})=1",
          f"(SELECT count(*) FROM unit_version WHERE unit_id={aid})=0",
          f"coalesce((SELECT verified_status FROM verification WHERE object_type='unit' AND object_id={aid} ORDER BY verified_at DESC, id DESC LIMIT 1),'') NOT IN {DEAD}",
          f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(r['system_id'])} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'",
          f"(SELECT count(*) FROM boe.amendment_note WHERE id={lit(r['note_id'])} AND position({lit(r['body'])} in new_text)>0)=1"]
st = [f"SELECT CASE WHEN {' AND '.join(g)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'g16u-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
if rows:
    st.append("INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES\n" + ',\n'.join(
        f"({lit(r['uid'])}, {lit(r['article_id'])}, {lit(r['body'])}, {lit(r['valid_from'])}::timestamptz, {lit(r['ev_instr'])}, {lit(r['ev_url'])}, {lit(r['quote'])}, now())" for r in rows))
fp = hashlib.md5('|'.join(f"{r['article_id']}:{r['valid_from']}:{hashlib.sha256(r['body'].encode()).hexdigest()}" for r in sorted(rows, key=lambda r: r['article_id'])).encode()).hexdigest()
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'g16u-%')={len(rows)} AND (SELECT md5(string_agg(unit_id||':'||valid_from::date||':'||encode(sha256(convert_to(body,'UTF8')),'hex'), '|' ORDER BY unit_id)) FROM unit_version WHERE id LIKE 'g16u-%')={lit(fp)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {},
           'report': {'versions': len(rows), 'new_articles': 0, 'changed_text': len(rows), 'skipped': skipped, 'open_dates': open_dates,
                      'plan': [dict(law=r['law'], n=r['n'], valid_from=r['valid_from'], instr=r['ev_instr']) for r in rows]},
           'statements': st, 'diag_guards': g}, open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'versions', len(rows), 'skipped', len(skipped), 'open dates', len(open_dates))
