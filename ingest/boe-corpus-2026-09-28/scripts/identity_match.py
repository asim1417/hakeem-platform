"""المرحلة د من أمر الهوية والسريان: مطابقة نسخ الهيئة بأنظمة حكيم بالاسم + أداة الإصدار + التاريخ.
قراءة فقط. المدخل: لقطة أنظمة حكيم (JSON من استعلام قراءة) + boe في قاعدة محلية.
  python3 scripts/identity_match.py <prod_systems.json> <out.json>
"""
import json, re, sys, difflib, collections, unicodedata
import psycopg

AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

def norm_name(x):
    x = unicodedata.normalize('NFC', x or '')
    x = re.sub('[ً-ْـ]', '', x)
    x = re.sub('[أإآ]', 'ا', x).replace('ة', 'ه').replace('ى', 'ي')
    x = re.sub(r'\(.*?\)', ' ', x)
    x = re.sub(r'[0-9٠-٩]+\s*ه?ـ?', ' ', x)
    x = re.sub('[^ء-ي ]', ' ', x)
    return ' '.join(x.split())

def year_in_name(x):
    m = re.search(r'(1[34]\d\d)\s*هـ', (x or '').translate(AR))
    return m.group(1) if m else None

INSTR = re.compile(r'(مرسوم ملكي|أمر ملكي|أمر سامي|قرار مجلس الوزراء)[^0-9م]*(?:رقم)?\s*\(?\s*((?:م\s*/\s*)?[0-9]+)\s*\)?\s*(?:و?بتاريخ|وتاريخ)\s*([0-9/\-\s]+)')

def parse_date(s):
    nums = re.findall(r'\d+', s)
    if len(nums) < 3:
        return None
    a, b, c = (int(n) for n in nums[:3])
    if a > 1000:   # y-m-d أو y/m/d
        y, m, d = a, b, c
    else:          # d/m/y
        d, m, y = a, b, c
    if not (1300 < y < 1500 and 1 <= m <= 12 and 1 <= d <= 30):
        return None
    return f'{y:04d}-{m:02d}-{d:02d}'

def instruments(text):
    out = set()
    for kind, no, date in INSTR.findall((text or '').translate(AR)):
        k = 'royal' if 'مرسوم' in kind or 'أمر' in kind else 'cabinet'
        out.add((k, re.sub(r'\s', '', no), parse_date(date)))
    return out

def main():
    prod = json.load(open(sys.argv[1]))
    con = psycopg.connect('postgresql://hk:hk@127.0.0.1/hakeem')
    rows = con.execute("""select distinct on (guid) guid, name, status_at_source, instruments::text, issued_hijri,
                          (select count(*) from boe.unit u where u.law_id=l.id), url
                          from boe.law l order by guid, parsed_at desc""").fetchall()
    H = collections.defaultdict(list)
    for p in prod:
        p['key'] = norm_name(p['name'])
        p['ins'] = instruments((p['prd'] or '') + ' ' + (p['art_decree'] or ''))
        H[p['key']].append(p)
    keys = list(H)
    out = []
    for guid, name, st, ins_txt, issued, n_units, url in rows:
        bi = set()
        for i in json.loads(ins_txt):
            bi |= instruments(i.get('text', ''))
        k = norm_name(name)
        cands = list(H.get(k, []))
        basis = 'exact_name'
        if not cands:
            close = difflib.get_close_matches(k, keys, n=3, cutoff=0.85)
            cands = [p for c in close for p in H[c]]
            basis = 'fuzzy_name' if cands else 'none'
        scored = []
        for p in cands:
            nos = {(a, b) for a, b, _ in bi} & {(a, b) for a, b, _ in p['ins']}
            dates = {c for *_, c in bi if c} & {c for *_, c in p['ins'] if c}
            full = {(a, b, c) for a, b, c in bi if c} & p['ins']
            if full: g = 1
            elif dates: g = 2
            elif nos: g = 3
            else: g = 4
            # تعارض السنة في الاسم مع أداة الطرف الآخر = ليس الزوج نفسه
            yb, yh = year_in_name(name), year_in_name(p['name'])
            if yb and yh and yb != yh: g = 9
            scored.append((g, p))
        scored.sort(key=lambda t: t[0])
        best = [s for s in scored if s[0] == scored[0][0]] if scored else []
        if len(best) > 1 and year_in_name(name):
            same = [s for s in best if year_in_name(s[1]['name']) == year_in_name(name)]
            if len(same) == 1:
                best = same
        if len(best) > 1 and not year_in_name(name):
            noyear = [s for s in best if not year_in_name(s[1]['name'])]
            if len(noyear) == 1:
                best = noyear
        if not scored:
            grade, pick = None, None
        elif len(best) > 1:
            grade, pick = 5, None
        else:
            grade, pick = best[0]
        out.append({
            'law_guid': guid, 'boe_name': name, 'boe_status': st, 'boe_units': n_units, 'boe_url': url,
            'boe_instruments': sorted(map(list, bi)), 'name_basis': basis,
            'grade': grade, 'auto': grade in (1, 2, 3),
            'system_id': pick['id'] if pick else None, 'hakeem_name': pick['name'] if pick else None,
            'hakeem_articles': int(pick['n']) if pick else None,
            'hakeem_status': pick['wstatus'] if pick else None,
            'hakeem_instruments': sorted(map(list, pick['ins'])) if pick else None,
            'candidates': [{'id': p['id'], 'name': p['name'], 'grade': g} for g, p in scored[:4]],
        })
    # نظام واحد في حكيم لا يقابل نسختين من الهيئة
    used = collections.Counter(o['system_id'] for o in out if o['system_id'])
    for o in out:
        if o['system_id'] and used[o['system_id']] > 1:
            o['grade'], o['auto'], o['conflict'] = 5, False, 'نظام حكيم نفسه مرشح لأكثر من نسخة'
    json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
    c = collections.Counter(o['grade'] for o in out)
    print('grades', dict(c))

if __name__ == '__main__':
    main()
