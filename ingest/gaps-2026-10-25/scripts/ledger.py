#!/usr/bin/env python3
"""سجل نواقص حكيم (HKM-051): يجمع ناتج sql/ledger.sql مع لقطتي الأنظمة والمواد ومصادر ثانوية، ثم يحلّ ويصفّي ويفرز.

  # 1) الجلب (قراءة فقط) — إمّا من DATABASE_URL بمعاملة READ ONLY:
  python3 scripts/ledger.py fetch --out out/
  # أو من ملفات JSON محفوظة من Neon MCP (ledger_raw / systems / articles) كما في تشغيل 2026-10-25.
  # 2) البناء:
  python3 scripts/ledger.py build --raw out/ledger_raw_2026-10-25.json --systems out/systems_2026-10-25.json \
      --articles out/articles_2026-10-25.json [--nezams /path/nezams_legal_db_v3_2_3.sqlite] --out out/

المخرجات: out/ledger.jsonl (بند لكل نقص، بحالته open/suppressed/resolved)، out/summary.json، out/ledger.xlsx.
لا يكتب في أي قاعدة. التسويات في exceptions.jsonl.
"""
import argparse, collections, hashlib, json, os, pathlib, re, sqlite3, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from arabic import law_key, masc_ordinal_word, norm, parse_repeal_clause  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
# هويات أكدها قارئان (readers/identity_confirmations.jsonl): (المادة المُلغية، النظام المستهدف)
CONFIRMED = {(c['repealer_article_id'], c['target_system_id']) for c in
             (json.loads(x) for x in open(ROOT / 'readers' / 'identity_confirmations.jsonl', encoding='utf-8') if x.strip()) if len(c.get('readers', [])) >= 2} \
    if (ROOT / 'readers' / 'identity_confirmations.jsonl').exists() else set()
TAX = json.load(open(ROOT / 'taxonomy.json', encoding='utf-8'))
REPEALED = {'ملغاة', 'ملغى', 'مستبدل'}
DEAD_WORK = {'مستبدل', 'ملغى', 'ملغاة', 'سجل مخلوط — لا يُعرض'}


def gid(*parts):
    return 'g-' + hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:16]


def fetch(out):
    import psycopg2
    url = os.environ.get('DATABASE_URL')
    if not url:
        sys.exit('DATABASE_URL غير مضبوط')
    con = psycopg2.connect(url)
    con.set_session(readonly=True, autocommit=False)
    cur = con.cursor()
    sql = open(ROOT / 'sql' / 'ledger.sql', encoding='utf-8').read()
    cur.execute(sql)
    rows = [list(r) for r in cur.fetchall()]
    json.dump({'source': 'DATABASE_URL (read only)', 'rows': rows}, open(out / 'ledger_raw.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
    for name, q in (('systems', open(ROOT / 'sql' / 'systems.sql', encoding='utf-8').read()),
                    ('articles', open(ROOT / 'sql' / 'articles.sql', encoding='utf-8').read())):
        cur.execute(q)
        json.dump(cur.fetchone()[1], open(out / f'{name}.json', 'w', encoding='utf-8'), ensure_ascii=False, default=str)
    con.rollback()
    con.close()


def load_exceptions():
    ex = []
    for line in open(ROOT / 'exceptions.jsonl', encoding='utf-8'):
        if line.strip():
            ex.append(json.loads(line))
    return ex


def suppressed_by(item, ex):
    for e in ex:
        if e['gap'] != item['gap']:
            continue
        if 'uqn' in e and e['uqn'] == (item.get('detail') or {}).get('uqn'):
            return e
        if 'repealer_article_id' in e and e['repealer_article_id'] == item.get('repealer_article_id'):
            if 'target' in e and law_key(e['target']) != law_key(item.get('target_law_as_cited') or ''):
                continue
            return e
        if 'system_id' in e and e['system_id'] == item.get('system_id'):
            n = item.get('article_number')
            if n is None or (e.get('from', -1) <= n <= e.get('to', 10 ** 6)):
                return e
    return None


class Corpus:
    def __init__(self, systems, articles):
        # systems: [id, name, rd, ws, kind, n_articles, boe "issued|instrument|status", effective]
        self.sys = {r[0]: r for r in systems}
        self.by_key = collections.defaultdict(list)
        for r in systems:
            self.by_key[law_key(r[1])].append(r)
            inner = re.findall(r'\(([^()]+)\)', r[1])
            for i in inner:
                if 'نظام' in i:
                    self.by_key[law_key(i)].append(r)
        self.arts = collections.defaultdict(list)  # sid → [id, n, bis, chapter, status, has_uv]
        for a in articles:
            self.arts[a[1]].append(a)

    def identity(self, law, instrument_no, year):
        """أنظمة حكيم التي تطابق الاسم، مرتبة بالدليل: الأداة (+2)، سنة الصدور (+1)، وتعارض السنة (-3).
        الدليل من ديباجة حكيم وبطاقة الهيئة المطابَقة معًا؛ يعيد [(score, verdict, row)]."""
        k = law_key(law)
        cands = list({r[0]: r for r in self.by_key.get(k, [])}.values())
        if not cands:  # احتواء: «نظام المحكمة التجارية» داخل «النظام التجاري ( نظام المحكمة التجارية)»
            cands = [r for r in self.sys.values() if k and k in law_key(r[1])]
        out = []
        for r in cands:
            ev = norm(' '.join(x for x in (r[2] or '', r[6] or '') if x)).replace(' ', '')
            digits = re.sub(r'\D', '', instrument_no or '')
            ok_no = bool(digits) and bool(re.search(r'(م/|رقم\(?|رقم\(م/|\(م/)' + digits + r'(?!\d)', ev))
            years = set(re.findall(r'1[34]\d\d', ev))
            ok_year = bool(year) and year in years
            clash = bool(year) and bool(years) and not ok_year and not ok_no
            other_no = bool(digits) and not ok_no and bool(re.search(r'رقم\(?\s*(م/)?\d', ev))
            score = 2 * ok_no + ok_year - 3 * clash
            if clash:
                verdict = 'clash'
            elif ok_no:
                verdict = 'match'
            elif ok_year:
                verdict = 'year_only' if other_no else 'match'
            else:
                verdict = 'unknown'
            out.append((score, verdict, r))
        out.sort(key=lambda x: (-x[0], x[2][3] in DEAD_WORK))
        return out

    def part_range(self, sid, part):
        """حدود «الباب (ن)» من علامات الأبواب في حقل chapter لمواد حكيم."""
        word = masc_ordinal_word(part)
        if not word:
            return None
        arts = sorted([a for a in self.arts.get(sid, []) if a[3] < 100], key=lambda a: (a[2], a[3]))
        start = end = None
        for a in arts:
            ch = norm(a[4] or '')
            if start is None and re.match(r'^الباب\s*\(?\s*' + word + r'(\s|\)|:|$)', ch):
                start = a[2]
            elif start is not None and re.match(r'^الباب\s', ch) and a[2] > start:
                end = a[2] - 1
                break
        if start is None:
            return None
        if end is None:
            end = max(a[2] for a in arts)
        return start, end


def resolve_u4b(row, corpus, ex):
    """يحوّل مادة إلغاء بالإحالة إلى بنود U4b على مستوى المادة المستهدفة."""
    out = []
    rep_sid, rep_aid, rep_n = row['system_id'], row['article_id'], row['article_number']
    rep_ws = corpus.sys.get(rep_sid, [None] * 8)[3]
    for clause in (row['detail'] or {}).get('clauses') or []:
        for t in parse_repeal_clause(clause):
            base = dict(gap='U4b', repealer_system_id=rep_sid, repealer_article_id=rep_aid, repealer_article=rep_n,
                        repealer_law=row['law'], target_law_as_cited=t['law'], target_instrument=t['instrument_no'], target_year=t['year'],
                        target_kind=t['kind'], target_part=t.get('part'), prio=row['prio'], clause=clause)
            if rep_ws in DEAD_WORK:
                out.append(dict(base, route='none', status='resolved', resolution='المادة المُلغية من إصدار غير ساري في حكيم'))
                continue
            if t['kind'] in ('unknown', 'whole'):
                out.append(dict(base, route='reader', status='open', resolution='عبارة الإلغاء لا تحدد مواد أو بابًا (إلغاء كامل أو غير محدد)'))
                continue
            scored = corpus.identity(t['law'], t['instrument_no'], t['year'])
            if not scored:
                out.append(dict(base, route='identity', status='open', resolution='الإصدار المستهدف غير موجود في حكيم بالاسم'))
                continue
            best_score, verdict, tgt = scored[0]
            cited = bool(t['instrument_no'] or t['year'])
            if cited and verdict == 'clash':
                out.append(dict(base, route='none', status='resolved', target_system_id=tgt[0], target_law=tgt[1],
                                resolution=f'الاسم يطابق «{tgt[1]}» لكن الأداة والسنة تخالفان ({tgt[2] or tgt[6]}) — الإصدار المُلغى منه ليس الإصدار الذي في حكيم'))
                continue
            if cited and verdict == 'year_only' and (rep_aid, tgt[0]) not in CONFIRMED:
                out.append(dict(base, route='identity', status='open', target_system_id=tgt[0], target_law=tgt[1],
                                resolution=f'الاسم والسنة يطابقان «{tgt[1]}» لكن أداة الإصدار المخزنة تخالف المذكورة ({tgt[2] or tgt[6]}): قارئ'))
                continue
            if cited and verdict == 'unknown':
                out.append(dict(base, route='identity', status='open', target_system_id=tgt[0], target_law=tgt[1],
                                resolution='الاسم يطابق ولا أداة ولا تاريخ مخزنان للتحقق من الإصدار'))
                continue
            if not cited:
                out.append(dict(base, route='identity', status='open', target_system_id=tgt[0], target_law=tgt[1],
                                resolution='عبارة الإلغاء لا تذكر أداة ولا تاريخًا؛ تُطابق الهوية بقارئ'))
                continue
            if not corpus.arts.get(tgt[0]):
                out.append(dict(base, route='fetch', status='open', target_system_id=tgt[0], target_law=tgt[1], resolution='النظام المستهدف بلا مواد في حكيم (W3)'))
                continue
            if tgt[3] in DEAD_WORK:
                out.append(dict(base, route='none', status='resolved', target_system_id=tgt[0], target_law=tgt[1], resolution=f'النظام المستهدف حالته «{tgt[3]}»'))
                continue
            if t['kind'] == 'paragraph' or t['kind'] == 'chapter_in_part':
                out.append(dict(base, route='reader', status='open', target_system_id=tgt[0], target_law=tgt[1], resolution='إلغاء فقرة/فصل داخل باب: يحتاج نسخة مادة (unit_version) أو حدود فصل بقارئ'))
                continue
            if t['kind'] == 'part':
                rng = corpus.part_range(tgt[0], t['part'])
                if not rng:
                    out.append(dict(base, route='reader', status='open', target_system_id=tgt[0], target_law=tgt[1],
                                    resolution=f'حدود الباب ({t["part"]}) غير معلّمة في حكيم؛ تُقرأ من صفحة الهيئة'))
                    continue
                numbers = list(range(rng[0], rng[1] + 1))
                basis = f'حدود الباب من علامات الأبواب في حكيم: {rng[0]}–{rng[1]}'
            else:
                numbers, basis = t['numbers'], 'أرقام المواد منصوصة في عبارة الإلغاء'
            arts = [a for a in corpus.arts.get(tgt[0], []) if a[3] < 100 and a[2] in numbers]
            missing = sorted(set(numbers) - {a[2] for a in arts})
            for a in sorted(arts, key=lambda a: (a[2], a[3])):
                item = dict(base, target_system_id=tgt[0], target_law=tgt[1], system_id=tgt[0], article_id=a[0], article_number=a[2],
                            article_bis=a[3], basis=basis, current_status=a[5], identity_score=best_score)
                if a[5] in REPEALED:
                    out.append(dict(item, route='none', status='resolved', resolution=f'مسجلة «{a[5]}» من قبل'))
                elif a[6]:
                    out.append(dict(item, route='reader', status='open', resolution='للمادة نسخة في unit_version: يُتحقق من تاريخ الإلغاء مقابل تاريخ النسخة'))
                else:
                    out.append(dict(item, route='build', status='open', resolution='جاهزة للبناء: إلغاء بالإحالة'))
            if missing:
                out.append(dict(base, target_system_id=tgt[0], target_law=tgt[1], route='reader', status='open',
                                resolution=f'أرقام في عبارة الإلغاء بلا مادة في حكيم: {missing[:20]}'))
    for o in out:
        o['id'] = gid('U4b', o.get('repealer_article_id'), o.get('target_law_as_cited'), o.get('article_id'), o.get('resolution', '')[:20])
        e = suppressed_by(o, ex)
        if e and o['status'] == 'open':
            o.update(status='suppressed', suppressed_by=e['reason'], suppressed_ref=e['ref'])
    return out


def nezams_candidates(path, corpus):
    """W1c/W2c وL2 من قاعدة nezams المجمّدة (مصدر ثانوي: يكشف ولا يُحقن)."""
    out = []
    c = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    q = """SELECT l.law_id, l.official_name, l.status_code, l.kind_code, l.source_url,
                  (SELECT count(*) FROM provisions p WHERE p.law_id = l.law_id), m.match_code
           FROM laws l LEFT JOIN law_official_match m ON m.law_id = l.law_id"""
    for lid, name, st, kind, url, n, mc in c.execute(q):
        if mc == 'matched':
            continue
        k = law_key(name)
        hits = corpus.by_key.get(k) or [r for r in corpus.sys.values() if k and (k in law_key(r[1]) or law_key(r[1]) in k) and len(law_key(r[1])) > 10]
        if hits:
            continue
        gap = 'W1c' if st == 'in_force' else 'W2c'
        tk = set(k.split())
        near = max(((len(tk & set(law_key(r[1]).split())) / max(1, len(tk | set(law_key(r[1]).split()))), r) for r in corpus.sys.values()), key=lambda x: x[0])
        route = 'identity' if near[0] >= 0.6 else 'fetch'
        out.append(dict(id=gid(gap, 'nezams', lid), gap=gap, route=route, status='open', prio=2 if kind == 'law' else 3, law=name,
                        nearest={'id': near[1][0], 'name': near[1][1], 'jaccard': round(near[0], 2)},
                        ref=url, detail={'nezams_law_id': lid, 'status': st, 'kind': kind, 'provisions': n},
                        resolution='غير موجود في حكيم بالاسم؛ يُجلب نصه من مصدر رسمي (أم القرى/الهيئة/الجهة) قبل أي حقن'))
    q2 = """SELECT l.law_id, l.official_name, count(DISTINCT r.provision_id), count(*) FROM regulation_texts r JOIN laws l USING(law_id)
            GROUP BY l.law_id, l.official_name"""
    for lid, name, n_prov, n_reg in c.execute(q2):
        hits = corpus.by_key.get(law_key(name)) or []
        out.append(dict(id=gid('L2', lid), gap='L2', route='reader', status='open', prio=1, law=name,
                        system_id=hits[0][0] if hits else None,
                        detail={'nezams_law_id': lid, 'provisions_with_regulation': n_prov, 'regulation_items': n_reg},
                        resolution='خريطة ربط مادة النظام بمادة لائحته من nezams؛ النص من لائحة حكيم بعد مطابقة القارئ'))
    return out


def moj_candidates(paths, corpus):
    """W1m/U1m من ملفات بوابة وزارة العدل في المستودع (data/moj-*.json): مصدر رسمي رتبة 3 بنصوص كاملة."""
    out = []
    for p in paths:
        for d in json.load(open(p, encoding='utf-8')):
            s = d['system']
            hits = corpus.by_key.get(law_key(s['name'])) or []
            n_off = s.get('officialArticleCount') or len(d.get('articles') or [])
            if not hits:
                out.append(dict(id=gid('W1m', s.get('sourceSerial')), gap='W1m', route='identity', status='open', prio=1, law=s['name'],
                                ref=s.get('sourceUrl'), detail={'parent': s.get('parentSystem'), 'articles': n_off, 'file': pathlib.Path(p).name},
                                resolution='غير موجود في حكيم بالاسم؛ نصه الكامل في ملف المستودع'))
                continue
            h = max(hits, key=lambda r: r[5])
            if h[5] < n_off:
                out.append(dict(id=gid('U1m', s.get('sourceSerial')), gap='U1m', route='reader', status='open', prio=1, law=h[1], system_id=h[0],
                                ref=s.get('sourceUrl'), detail={'hakeem_articles': h[5], 'moj_articles': n_off, 'file': pathlib.Path(p).name},
                                resolution=f'حكيم {h[5]} مادة والبوابة {n_off}'))
    return out


def nezams_tables(path, corpus):
    """T1: جداول وملاحق في nezams لأنظمة موجودة في حكيم (مصدر ثانوي: يكشف فقط)."""
    c = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    q = """SELECT l.law_id, l.official_name, (SELECT count(*) FROM law_tables t WHERE t.law_id = l.law_id), (SELECT count(*) FROM appendices a WHERE a.law_id = l.law_id)
           FROM laws l WHERE EXISTS (SELECT 1 FROM law_tables t WHERE t.law_id = l.law_id) OR EXISTS (SELECT 1 FROM appendices a WHERE a.law_id = l.law_id)"""
    out = []
    # N1: لنظام nezams غير المطابَق بالهيئة وله نظير في حكيم بالاسم: مواد nezams أكثر من مواد حكيم
    q1 = """SELECT l.law_id, l.official_name, (SELECT count(*) FROM provisions p WHERE p.law_id = l.law_id), m.match_code
            FROM laws l LEFT JOIN law_official_match m ON m.law_id = l.law_id"""
    for lid, name, n, mc in c.execute(q1):
        if mc == 'matched':
            continue
        hits = corpus.by_key.get(law_key(name)) or []
        if hits:
            h = max(hits, key=lambda r: r[5])
            if n > h[5] + 1:
                out.append(dict(id=gid('N1', lid), gap='N1', route='fetch', status='open', prio=2, law=h[1], system_id=h[0],
                                detail={'nezams_law_id': lid, 'nezams_provisions': n, 'hakeem_articles': h[5]},
                                resolution=f'nezams {n} مادة وحكيم {h[5]}؛ يُقابل بالمصدر الرسمي قبل أي إضافة'))
    for lid, name, nt, na in c.execute(q):
        hits = corpus.by_key.get(law_key(name)) or []
        if not hits:
            continue
        out.append(dict(id=gid('T1', lid), gap='T1', route='fetch', status='open', prio=2, law=hits[0][1], system_id=hits[0][0],
                        detail={'nezams_law_id': lid, 'tables': nt, 'appendices': na},
                        resolution='جداول/ملاحق في nezams؛ يُطلب الأصل الرسمي (مرفقات الهيئة) ويُقابل بما في حكيم'))
    return out


def build(a):
    out = pathlib.Path(a.out)
    raw = json.load(open(a.raw, encoding='utf-8'))
    systems = json.load(open(a.systems, encoding='utf-8'))
    articles = json.load(open(a.articles, encoding='utf-8'))
    corpus = Corpus(systems, articles)
    ex = load_exceptions()
    items = []
    for gap, route, prio, sid, law, aid, art, ref, detail in raw['rows']:
        if gap == 'U4b':
            items += resolve_u4b(dict(gap=gap, prio=prio, system_id=sid, law=law, article_id=aid, article_number=art, detail=detail), corpus, ex)
            continue
        key = (detail or {}).get('note') if gap == 'U3' else (json.dumps(detail, ensure_ascii=False, sort_keys=True) if gap in ('W1b', 'W2a', 'Q1', 'Q2') else '')
        it = dict(id=gid(gap, sid, aid, art, key),
                  gap=gap, route=route, prio=prio, system_id=sid,
                  law=law or (corpus.sys.get(sid) or [None, None])[1], article_id=aid, article_number=art, ref=ref, detail=detail, status='open')
        if gap == 'U3':  # يقبل الإسقاط المضغوط ({note, s, nt}) والكامل (same_as_boe_body, has_new_text)
            d = detail or {}
            same = d.get('same_as_boe_body', d.get('s'))
            it['subtype'] = 'shows_original' if same else 'differs_from_boe'
            it['resolution'] = ('نص حكيم = نص الهيئة الأصلي والملاحظة تعدّله: يعرض حكيم النص قبل التعديل' if same else
                                'نص حكيم يخالف نص الهيئة الأصلي: قد يكون التعديل مطبقًا بلا نسخة، أو فرقًا آخر')
        if gap == 'W2a':  # هوية الإصدار القديم: اسم + سنة الصدور
            yr = re.findall(r'1[34]\d\d', (detail or {}).get('issued') or '')
            hits = [r for r in corpus.by_key.get(law_key(law), []) if yr and yr[0] in norm((r[2] or '') + ' ' + (r[6] or '') + ' ' + r[1])]
            if hits:
                it.update(status='resolved', resolution=f'الإصدار موجود في حكيم: {hits[0][1]} ({hits[0][0]})', system_id=hits[0][0])
            else:
                it.update(route='build' if (detail or {}).get('units') else 'fetch',
                          resolution='الإصدار الملغى غير موجود في حكيم؛ نصه في لقطة الهيئة' if (detail or {}).get('units') else 'بلا نص في اللقطة')
        if gap == 'W1b' and (detail or {}).get('parse') == 'complete':
            if corpus.by_key.get(law_key(law)):
                it.update(status='resolved', resolution='موجود في حكيم بالاسم نفسه (من مصدر آخر)')
        e = suppressed_by(it, ex)
        if e and it['status'] == 'open':
            it.update(status='suppressed', suppressed_by=e['reason'], suppressed_ref=e['ref'])
        items.append(it)
    if a.raw_sources:  # الجزء الثاني: sql/ledger_sources.sql
        for gap, route, prio, sid, law, aid, art, ref, detail in json.load(open(a.raw_sources, encoding='utf-8'))['rows']:
            it = dict(id=gid(gap, sid, aid, art, json.dumps(detail, ensure_ascii=False, sort_keys=True)), gap=gap, route=route, prio=prio,
                      system_id=sid, law=law or (corpus.sys.get(sid) or [None, None])[1], article_id=aid, article_number=art, ref=ref,
                      detail=detail, status='open')
            if gap == 'U5u':
                d = detail or {}
                it['subtype'] = 'hakeem_edit' if d.get('hakeem_edit') else ('near' if (d.get('sim') or 0) >= 0.95 else 'different')
            items.append(it)
    if a.moj:
        items += moj_candidates(a.moj, corpus)
    if a.nezams:
        items += nezams_candidates(a.nezams, corpus)
        items += nezams_tables(a.nezams, corpus)
    # منع الازدواج: المادة المشطوبة (U4a) أو ذات الملاحظة (U3) التي تغطيها دفعة إلغاء بالإحالة (U4b build) تُحسم بها
    u4b = {i['article_id']: i for i in items if i['gap'] == 'U4b' and i['route'] == 'build' and i['status'] == 'open'}
    for i in items:
        if i['gap'] in ('U4a', 'U3') and i['status'] == 'open' and i.get('article_id') in u4b:
            r = u4b[i['article_id']]
            i.update(status='resolved', route='none', covered_by=r['id'],
                     resolution=f"يغطيه U4b: {r['repealer_law']} م{r['repealer_article']}")
    for it in items:
        meta = TAX['gaps'].get(it['gap'], {})
        it['name_ar'] = meta.get('name')
        it['source_rank'] = meta.get('source_rank')
    with open(out / 'ledger.jsonl', 'w', encoding='utf-8') as f:
        for it in sorted(items, key=lambda x: (x['gap'], x.get('prio') or 9, x.get('law') or '', x.get('article_number') or 0)):
            f.write(json.dumps(it, ensure_ascii=False, default=str) + '\n')
    summ = collections.Counter((i['gap'], i['status'], i['route']) for i in items)
    summary = {'taken_at': raw.get('taken_at'), 'source': raw.get('source'), 'total': len(items),
               'by_gap': {g: {'name': TAX['gaps'][g]['name'],
                              'open': sum(v for (gg, st, r), v in summ.items() if gg == g and st == 'open'),
                              'routes': {r: v for (gg, st, r), v in summ.items() if gg == g and st == 'open'},
                              'resolved': sum(v for (gg, st, r), v in summ.items() if gg == g and st == 'resolved'),
                              'suppressed': sum(v for (gg, st, r), v in summ.items() if gg == g and st == 'suppressed')}
                          for g in sorted({i['gap'] for i in items})}}
    json.dump(summary, open(out / 'summary.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_xlsx(items, summary, out / 'ledger.xlsx')
    for g, v in summary['by_gap'].items():
        print(f"{g:4} {v['name'][:48]:48} مفتوح {v['open']:4}  {v['routes']}  محسوم {v['resolved']}  مستثنى {v['suppressed']}")


def write_xlsx(items, summary, path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font
    wb = Workbook()
    ws = wb.active
    ws.title = 'الملخص'
    ws.sheet_view.rightToLeft = True
    ws.append(['الرمز', 'النقص', 'مفتوح', 'المسارات', 'محسوم', 'مستثنى'])
    for g, v in summary['by_gap'].items():
        ws.append([g, v['name'], v['open'], json.dumps(v['routes'], ensure_ascii=False), v['resolved'], v['suppressed']])
    for c in ws[1]:
        c.font = Font(bold=True)
    cols = ['id', 'gap', 'name_ar', 'status', 'route', 'prio', 'law', 'system_id', 'article_number', 'article_id', 'resolution', 'ref',
            'repealer_law', 'repealer_article', 'target_law_as_cited', 'basis', 'suppressed_by', 'detail']
    for g in summary['by_gap']:
        sh = wb.create_sheet(g)
        sh.sheet_view.rightToLeft = True
        sh.append(cols)
        for c in sh[1]:
            c.font = Font(bold=True)
        for it in items:
            if it['gap'] == g:
                sh.append([json.dumps(it.get(k), ensure_ascii=False) if isinstance(it.get(k), (dict, list)) else it.get(k) for k in cols])
        for col in ('G', 'K', 'R'):
            sh.column_dimensions[col].width = 50
        for row in sh.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=False, vertical='top')
    wb.save(path)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    f = sp.add_parser('fetch')
    f.add_argument('--out', required=True)
    b = sp.add_parser('build')
    b.add_argument('--raw', required=True)
    b.add_argument('--systems', required=True)
    b.add_argument('--articles', required=True)
    b.add_argument('--nezams')
    b.add_argument('--raw-sources')
    b.add_argument('--moj', nargs='*')
    b.add_argument('--out', required=True)
    a = ap.parse_args()
    if a.cmd == 'fetch':
        fetch(pathlib.Path(a.out))
    else:
        build(a)


if __name__ == '__main__':
    main()
