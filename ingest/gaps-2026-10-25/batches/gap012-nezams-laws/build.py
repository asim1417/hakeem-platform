#!/usr/bin/env python3
"""gap012 (HKM-051، W1c): إدخال أدوات سارية من نظما ليست في حكيم ولا في لقطة الهيئة ولا في أم القرى المخزنة.

السند: قرار المالك 28/10/2026 «اعتبر موقع نظما مصدر رسمي الا اذا خالفاه موقع هيئة الخبراء او جريدة ام القرى».
يُدخل ما حكم فيه المراجع المستقل «ok» فقط (verify.json): النص يطابق صفحة نظما، ولا مخالفة من الهيئة أو أم القرى.
على نمط gap011: إضافة فقط (legal_systems، legal_articles، verification «ساري»، legal_text_provenance بالمصدر nezams). لا UPDATE ولا DELETE.

    python3 batches/gap012-nezams-laws/build.py
"""
import datetime, hashlib, json
from pathlib import Path
from hijri_converter import Hijri

D = Path(__file__).parent
BY = 'gap012-nezams-laws-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
CLS = {36: 'أنظمة التجارة والاقتصاد والاستثمار', 381: 'أنظمة الأمن الداخلي والأحوال المدنية والأنظمة الجنائية', 319: None,
       77: 'أنظمة الحج والشؤون الإسلامية', 127: 'أنظمة السلطة القضائية وحقوق الإنسان', 370: 'أنظمة السلطة القضائية وحقوق الإنسان',
       236: 'أنظمة السلطة القضائية وحقوق الإنسان'}
OWNER = 'قرار المالك 28/10/2026: نظما مصدر معتمد ما لم تخالفه هيئة الخبراء أو أم القرى'


def lit(v):
    if v is None:
        return 'NULL'
    if isinstance(v, int):
        return str(v)
    assert '$hk$' not in v
    return f'$hk${v}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def g(hij):
    y, m, d = map(int, hij.split('-'))
    return Hijri(y, m, d).to_gregorian()


def hy(hij):
    return hij.replace('-', '/') + 'هـ'


laws = json.loads((D / 'laws.json').read_text(encoding='utf-8'))
slugs = json.loads((D / 'slugs.json').read_text(encoding='utf-8'))
ver = json.loads((D / 'verify.json').read_text(encoding='utf-8')) if (D / 'verify.json').exists() else {}
ok = [k for k in laws if (ver.get(k) or {}).get('verdict') == 'ok']
skipped = {k: (ver.get(k) or {}).get('verdict', 'no_review') for k in laws if k not in ok}
guards, st, total_arts, plan = [], [], 0, []
for k in ok:
    L = laws[k]
    lid = int(k)
    sid = 'nz26-' + h('nezams', k)
    name, slug, instr, n = L['name'], slugs[k], L['instr'], len(L['articles'])
    eff = None
    if L['eff_base']:
        base = L['published'] if L['eff_base'] == 'published' else L['issued']
        eff = (g(base) + datetime.timedelta(days=L['eff_days'])).isoformat()
    eff_art = L['articles'][L['eff_art'] - 1] if L['eff_art'] else None
    pre = f"أداة الإصدار:\n{instr}\nتاريخ الإصدار (هجريّ): {L['issued']}\nتاريخ الإصدار (ميلاديّ): {g(L['issued'])}"
    if L['published']:
        pre += f"\nتاريخ النشر: {hy(L['published'])} ({g(L['published'])})"
    pre += f"\nالمصدر: نظما ({L['url']})"
    aid = {a['n']: 'nz26-' + h(sid, 'article', str(a['n'])) for a in L['articles']}
    guards.append(f"(SELECT count(*) FROM legal_systems WHERE id={lit(sid)} OR name={lit(name)} OR eli_slug={lit(slug)})=0 "
                  f"AND (SELECT count(*) FROM legal_articles WHERE \"lawName\"={lit(name)})=0")
    st.append(f"""INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
VALUES ({lit(sid)}, {lit(name)}, {lit(CLS[lid])}, {n}, now(), now(), NULL, NULL, 0, {lit(slug)}, {lit(pre)}, {lit(instr)}, {lit(eff) + '::timestamp' if eff else 'NULL'}, now(), {lit(L['kind'])})""")
    vals = ',\n'.join(f"({lit(aid[a['n']])}, {a['n']}, {lit(a['title'])}, {lit(a['chapter'])}, {lit(a['content'])})" for a in L['articles'])
    st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT v.id, s.id, s.name, s.classification, v.n, 0, v.title, v.content, v.chapter, {lit(instr)}, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, v.title, v.content, ARRAY[]::text[], s.classification, v.chapter)
FROM (VALUES
{vals}
) AS v(id, n, title, chapter, content) JOIN legal_systems s ON s.id={lit(sid)}""")
    inst_ev = instr + (f' — من {eff}' if eff else '')
    q = (f"حالة الأداة في نظما: ساري (لقطة 2026-09-28). {OWNER}، وراجعها مراجع مستقل فلم يجد مخالفة منهما (28/10/2026)."
         + (f" المادة ({L['articles'][L['eff_art'] - 1]['title']}): «{eff_art['content']}» — يُعمل بها من {eff}" if eff_art else ''))
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES ({lit('vfg12-' + h(BY, 'work', sid))}, 'work', {lit(sid)}, 'ساري', {lit(inst_ev)}, {lit(L['url'])}, {lit(q)}, 'owner_decision', {lit(BY)}, NULL)""")
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg12-'||left(encode(sha256(convert_to({lit(BY)}||'|unit|'||a.id,'UTF8')),'hex'),24), 'unit', a.id, 'ساري', {lit(inst_ev)}, {lit(L['url'])},
  {lit('نص المادة كما في نظما (لقطة 2026-09-28)؛ ' + OWNER)}, 'owner_decision', {lit(BY)}, NULL
FROM legal_articles a WHERE a."legalSystemId"={lit(sid)}""")
    pv = [f"({lit('g12p-' + h(BY, sid, 'system'))}, 'system', {lit(sid)}, {lit(name)}, NULL, 'nezams', {lit('nezams:' + k)}, {lit(L['url'])}, NULL, DATE '2026-10-28', 'insert:nezams', NULL)"]
    pv += [f"({lit('g12p-' + h(BY, sid, str(a['n'])))}, 'article', {lit(aid[a['n']])}, {lit(name)}, {a['n']}, 'nezams', {lit('nezams:' + k)}, {lit(L['url'])}, {lit(a['sha256'])}, DATE '2026-10-28', 'insert:nezams', NULL)" for a in L['articles']]
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text)\nVALUES\n" + ',\n'.join(pv))
    shas = ','.join(a['sha256'] for a in L['articles'])
    guards.append(None)
    plan.append(dict(k=k, sid=sid, n=n, shas=shas))
    total_arts += n
before = ' AND '.join(x for x in guards if x)
st.insert(0, f"SELECT CASE WHEN {before} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 THEN 'ok' ELSE {FAIL} END AS guard_before")
after = ' AND '.join(
    f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(p['sid'])} AND coalesce(search_norm,'')<>'')={p['n']} "
    f"AND (SELECT string_agg(encode(sha256(convert_to(content,'UTF8')),'hex'), ',' ORDER BY \"articleNumber\") FROM legal_articles WHERE \"legalSystemId\"={lit(p['sid'])})={lit(p['shas'])} "
    f"AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)} AND (object_id={lit(p['sid'])} OR object_id IN (SELECT id FROM legal_articles WHERE \"legalSystemId\"={lit(p['sid'])})))={p['n'] + 1}"
    for p in plan)
st.append(f"SELECT CASE WHEN {after} AND (SELECT count(*) FROM legal_text_provenance WHERE source='nezams' AND id LIKE 'g12p-%')={total_arts + len(plan)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'laws': ok, 'skipped': skipped,
                                               'expect_delta': {'public.legal_articles': total_arts, 'public.legal_systems': len(ok)}, 'statements': st},
                                              ensure_ascii=False, indent=1), encoding='utf-8')
print(md5, len(st), 'laws', ok, 'articles', total_arts, 'skipped', skipped)
