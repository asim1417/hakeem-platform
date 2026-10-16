"""المرحلة و: مقارنة نص المادة داخل الزوج ثابت الهوية فقط (الدرجة ١). قراءة فقط.
  python3 scripts/text_compare.py <identity_match.json> <prod_articles.json> <out.json>
تطبيع المقارنة: NFC ثم حذف المسافات والتطويل — مطابق لما يحسبه استعلام md5 في حكيم.
"""
import json, re, sys, hashlib, unicodedata, collections
import psycopg

def h(t):
    return hashlib.md5(re.sub(r'[\sـ]', '', unicodedata.normalize('NFC', t)).encode()).hexdigest()

def main():
    im = [x for x in json.load(open(sys.argv[1])) if x['grade'] == 1]
    arts = collections.defaultdict(dict)
    for a in json.load(open(sys.argv[2])):
        arts[a['s']][int(a['n'])] = a
    con = psycopg.connect('postgresql://hk:hk@127.0.0.1/hakeem')
    out, tot = [], collections.Counter()
    for m in im:
        units = con.execute("""select u.article_number, u.is_bis, u.body from boe.unit u
            join boe.law l on l.id=u.law_id where l.guid=%s and l.parsed_at=(select max(parsed_at) from boe.law where guid=%s)""",
            (m['law_guid'], m['law_guid'])).fetchall()
        boe = {n: b for n, bis, b in units if n is not None and not bis}
        bis = sum(1 for _, b, _ in units if b)
        hk = arts.get(m['system_id'], {})
        c = collections.Counter()
        diff = []
        for n, body in boe.items():
            if n not in hk: c['ناقصة في حكيم'] += 1; diff.append([n, 'ناقصة'])
            elif hk[n]['h'] == h(body): c['مطابقة'] += 1
            else: c['مختلفة'] += 1; diff.append([n, 'مختلفة'])
        for n in hk:
            if n not in boe: c['زائدة في حكيم'] += 1
        c['مكرر في الهيئة'] = bis
        tot.update(c)
        out.append({**{k: m[k] for k in ('law_guid', 'boe_name', 'system_id', 'boe_status')}, 'counts': dict(c), 'diff': diff})
    json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False)
    print(dict(tot), 'laws', len(out), 'fully_identical', sum(1 for o in out if set(o['counts']) <= {'مطابقة', 'مكرر في الهيئة'} and not o['counts'].get('مكرر في الهيئة')))

if __name__ == '__main__':
    main()
