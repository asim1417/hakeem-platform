"""تصنيف الفروق النصية: شكلي أم لفظي، وهل نص حكيم هو النص المعدّل من ملاحظات الهيئة. قراءة فقط.
  python3 scripts/diff_classify.py <text_compare.json> <prod_diff_content.json> <out.json>
"""
import json, re, sys, unicodedata, difflib, collections
import psycopg

def n2(t):
    t = unicodedata.normalize('NFC', t or '')
    t = t.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
    t = re.sub(r'^\s*المادة\s+[^\n:]{1,60}:\s*', '', t)
    t = re.sub(r'(?m)^\s*(\(?[0-9]+\)?|\(?[أ-ي]\)?)\s*[-–—)\.]\s*', '', t)
    t = re.sub('[ً-ْٰـ]', '', t)
    t = re.sub(r'[^\w]', '', t)
    return t

def main():
    tc = json.load(open(sys.argv[1]))
    hk = {(a['s'], int(a['n'])): a['c'] for a in json.load(open(sys.argv[2]))}
    con = psycopg.connect('postgresql://hk:hk@127.0.0.1/hakeem')
    res, tot = [], collections.Counter()
    for o in tc:
        for n, kind in o['diff']:
            if kind != 'مختلفة':
                continue
            row = con.execute("""select u.body from boe.unit u join boe.law l on l.id=u.law_id where l.guid=%s and u.article_number=%s
                                 and not u.is_bis order by l.parsed_at desc limit 1""", (o['law_guid'], n)).fetchone()
            b, h = row[0], hk.get((o['system_id'], n), '')
            nb, nh = n2(b), n2(h)
            news = [r[0] for r in con.execute("""select coalesce(corrected_text,new_text) from boe.v_amendment
                     where law_guid=%s and unit_seq in (select seq from boe.unit u join boe.law l on l.id=u.law_id
                     where l.guid=%s and u.article_number=%s) and coalesce(corrected_text,new_text) is not null""",
                     (o['law_guid'], o['law_guid'], n)).fetchall()]
            if nb == nh:
                k = 'شكلي'
            elif any(n2(x) and (n2(x) == nh or n2(x) in nh) for x in news):
                k = 'حكيم فيه النص المعدّل'
            else:
                r = difflib.SequenceMatcher(None, nb, nh, autojunk=False).ratio()
                k = 'لفظي طفيف' if r >= 0.97 else ('لفظي' if r >= 0.8 else 'مختلف جوهريًّا')
            tot[k] += 1
            res.append({'law': o['boe_name'], 'system_id': o['system_id'], 'article': n, 'class': k,
                        'has_boe_amendment': bool(news)})
    json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False)
    print(dict(tot))
    print('مختلف جوهريًّا وله تعديل في الهيئة', sum(1 for r in res if r['class'] == 'مختلف جوهريًّا' and r['has_boe_amendment']))

if __name__ == '__main__':
    main()
