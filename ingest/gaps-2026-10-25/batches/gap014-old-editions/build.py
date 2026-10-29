#!/usr/bin/env python3
"""gap014 (HKM-052، الصنف W2a): إصدارات ملغاة أو قديمة في لقطة هيئة الخبراء غائبة عن حكيم، تُدخل لعرض «كما في تاريخ».

على نمط HKM-038 (build_gcc.py): النص من boe.unit بلا إعادة كتابة، والسجل بمعرّف لقطة الهيئة نفسه (boe.law.id).
المدخل: decisions.json (ما اتفق عليه القارئان e وf، أو حسمه المراجع)، لكل بند:
  successor_id، relation («مستبدل» إن كان الخلف إصدارًا جديدًا للعمل نفسه، و«ملغى» إن ألغته أداة لموضوع أوسع)،
  same_work، clause_quote وclause_where (hakeem:<sid>:<n> أو boe_block:<law id>:<kind>)، repeal_effective، old_effective (أو null)، seq_max (اختياري).
لكل بند يُضاف: legal_systems (اسم مميِّز بأداة الإصدار)، legal_articles (حالة العمود «ملغاة»)، verification للعمل والمواد بالحالة،
legal_text_provenance (المصدر boe)، law_card، boe.match؛ وللعمل نفسه: search_surface (القديم ثم الخلف) وsearch_surface_member (edition_old وedition_new).
إضافة فقط: لا UPDATE ولا DELETE.

    python3 batches/gap014-old-editions/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
BY = 'gap014-old-editions-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
NUM = 'coalesce(u.article_number, f.article_number, u.seq)'
KIND = {'نظام': 'نظام', 'النظام': 'نظام', 'تنظيم': 'تنظيم', 'قواعد': 'قواعد', 'لائحة': 'لائحة'}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def instr_phrase(t):
    """«مرسوم ملكي رقم م/25 بتاريخ 4 / 5 / 1425» → «بالمرسوم الملكي رقم (م/25) وتاريخ 1425/5/4هـ»."""
    t = t.translate(AR)
    m = re.search(r'رقم\s*\(?\s*([^\s()]+(?:\s*/\s*[^\s()]+)?)\s*\)?\s*(?:بتاريخ|وتاريخ)\s*([\d\s/\-]+)', t)
    assert m, t
    no = re.sub(r'\s+', '', m.group(1))
    parts = [int(x) for x in re.findall(r'\d+', m.group(2))]
    y, mo, d = (parts[0], parts[1], parts[2]) if parts[0] > 1000 else (parts[-1], parts[-2], parts[-3])
    head = 'بالمرسوم الملكي' if t.startswith('مرسوم') else ('بالأمر الملكي' if t.startswith('أمر') else 'بقرار مجلس الوزراء')
    return f'{head} رقم ({no}) وتاريخ {y}/{mo}/{d}هـ', f'{y}-{mo:02d}-{d:02d}'


def edition_name(old):
    base = re.sub(r'\s*\d{4}\s*هـ\s*$', '', old['name']).strip()
    base = re.sub(r'(^|\s)و\s+', r'\1و', re.sub(r'\s+', ' ', base))
    ph, _ = instr_phrase(old['instruments'][0]['text'])
    return f"{base} {'الصادرة' if base.split()[0] in ('لائحة', 'قواعد') else 'الصادر'} {ph}"


P = json.load(open(D / 'packets.json', encoding='utf-8'))
items = {p['boe_id']: p for p in P['items']}
succ = P['successor_details']
dec = json.load(open(D / 'decisions.json', encoding='utf-8'))['items']
slugs = json.load(open(D / 'slugs.json', encoding='utf-8'))
st, guards, after, plan = [], [], [], []
tot_arts = 0
for d in dec:
    p = items[d['boe_id']]
    old, lid, sid = p['old'], d['boe_id'], d['successor_id']
    s = succ[sid]
    name = edition_name(old)
    slug = slugs[name]
    kind = KIND[name.split()[0]]
    instrs = ' '.join(re.sub(r'\s+', ' ', x['text']).strip().rstrip('.') for x in old['instruments'])
    _, issued = instr_phrase(old['instruments'][0]['text'])
    status = d['relation']
    assert status in ('مستبدل', 'ملغى'), d
    unit_status = 'مستبدل' if status == 'مستبدل' else 'ملغاة'
    seq_max = d.get('seq_max')
    useq = f" AND u.seq<={int(seq_max)}" if seq_max else ''
    n_units = int(seq_max) if seq_max else int(old['units'])
    succ_instr = re.match(r'^(.*?هـ)', (s['instr'] or '').strip())
    succ_instr = (succ_instr.group(1) if succ_instr else (s['instr'] or '').strip()).strip()
    where = d['clause_where']
    if where.startswith('hakeem:'):
        _, wsid, wn = where.split(':')
        ref = f"المادة ({wn}) من {s['name']}"
        cguard = (f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(wsid)} AND \"articleNumber\"={int(wn)} AND \"articleBis\"<100 "
                  f"AND position({lit(d['clause_quote'])} in content)>0)=1")
    else:
        _, wlid, wkind = where.split(':')
        ref = f"البند (ثانيًا) من المرسوم الملكي بإصدار {s['name']}" if wkind == 'royal_decree' else f"قرار مجلس الوزراء بإصدار {s['name']}"
        cguard = f"(SELECT count(*) FROM boe.text_block WHERE law_id={lit(wlid)} AND kind={lit(wkind)} AND position({lit(d['clause_quote'])} in body)>0)>=1"
    ev_instr = f"{succ_instr} — {ref} — من {d['repeal_effective']}"
    succ_url = ((s.get('boe') or [{}])[0] or {}).get('url') or old['url']
    quote = (f"{ref}: «{d['clause_quote']}»؛ يسري الإلغاء بنفاذ الخلف في {d['repeal_effective']} ({d['repeal_basis']})"
             + (f"؛ {d['note']}" if d.get('note') else '') + ' [قارئان مستقلان متفقان، HKM-052]')
    pre = (f"أداة الإصدار:\n{instrs}\nتاريخ الإصدار (هجريّ): {issued}"
           + (f"\nتاريخ النشر: {old['published']}هـ ({old['published_g']})" if old.get('published') and not old['published'].endswith('/01/01') else '')
           + f"\nالحالة: {status} — {ref}، من {d['repeal_effective']}\nالمصدر: هيئة الخبراء ({old['url']})")
    eff = d.get('old_effective')
    guards += [
        f"(SELECT count(*) FROM boe.law WHERE id={lit(lid)} AND guid={lit(old['guid'])} AND status_at_source='لاغي')=1",
        f"(SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(lid)}{useq})={n_units}",
        f"(SELECT count(DISTINCT {NUM}) FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id={lit(lid)}{useq})={n_units}",
        f"(SELECT count(*) FROM legal_systems WHERE id={lit(lid)} OR name={lit(name)} OR eli_slug={lit(slug)})=0",
        f"(SELECT count(*) FROM legal_systems WHERE id={lit(sid)} AND name={lit(s['name'])})=1",
        f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(sid)} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'",
        cguard,
    ]
    st.append(f"""INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
SELECT {lit(lid)}, {lit(name)}, o.classification, {n_units}, now(), now(), o.domain, o.domain_title, 0, {lit(slug)}, {lit(pre)}, {lit(instrs)}, {lit(eff) + '::timestamp' if eff else 'NULL'}, now(), {lit(kind)}
FROM legal_systems o WHERE o.id={lit(sid)}""")
    st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT 'boe26-'||left(encode(sha256(convert_to(l.id||'|article|'||{NUM},'UTF8')),'hex'),24), l.id, s.name, s.classification, {NUM}, 0,
  coalesce(nullif(btrim(rtrim(u.heading, ':')),''), 'المادة '||{NUM}), u.body, {lit(instrs)}, NULL, 'ملغاة', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, coalesce(nullif(btrim(rtrim(u.heading, ':')),''), 'المادة '||{NUM}), u.body, ARRAY[]::text[], s.classification, NULL)
FROM boe.law l JOIN legal_systems s ON s.id=l.id JOIN boe.unit u ON u.law_id=l.id LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE l.id={lit(lid)}{useq} ORDER BY u.seq""")
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES ({lit('vfg14-' + h(BY, 'work', lid))}, 'work', {lit(lid)}, {lit(status)}, {lit(ev_instr)}, {lit(succ_url)}, {lit(quote)}, 'rule', {lit(BY)}, NULL)""")
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg14-'||left(encode(sha256(convert_to({lit(BY)}||'|unit|'||a.id,'UTF8')),'hex'),24), 'unit', a.id, {lit(unit_status)}, {lit(ev_instr)}, {lit(old['url'])},
  {lit('نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026، حالة الأداة «لاغي»)؛ ' + quote)}, 'rule', {lit(BY)}, NULL
FROM legal_articles a WHERE a."legalSystemId"={lit(lid)}""")
    st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text)
SELECT {lit('g14p-' + h(BY, lid, 'system'))}, 'system', {lit(lid)}, {lit(name)}, NULL, 'boe', {lit('boe:' + old['guid'])}, {lit(old['url'])}, NULL, DATE '2026-09-28', 'insert:boe_snapshot', NULL
UNION ALL
SELECT 'g14p-'||left(encode(sha256(convert_to({lit(BY)}||'|'||a.id,'UTF8')),'hex'),24), 'article', a.id, {lit(name)}, a."articleNumber", 'boe', {lit('boe:' + old['guid'])}, {lit(old['url'])},
  encode(sha256(convert_to(a.content,'UTF8')),'hex'), DATE '2026-09-28', 'insert:boe_snapshot', NULL FROM legal_articles a WHERE a."legalSystemId"={lit(lid)}""")
    st.append(f"""INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT {lit('lc14-' + h(BY, lid))}, l.id, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, l.status_at_source, l.category_path, l.instruments,
  coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) FROM boe.text_block b WHERE b.law_id=l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28', {lit(BY)}
FROM boe.law l WHERE l.id={lit(lid)}""")
    st.append(f"""INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('g14m-' + h(BY, old['guid'])[:20])}, {lit(old['guid'])}, {lit(lid)}, 'owner', jsonb_build_object('basis', {lit('gap014 (HKM-052): الإصدار الملغى مُدخل من لقطة الهيئة؛ ' + ref)}), {lit(BY)}, now())""")
    n_surf = 0
    if d['same_work']:
        wk = f'we:{sid}'
        old_from = eff or issued
        old_s, new_s = 'ssg14-' + h(BY, wk, 'old'), 'ssg14-' + h(BY, wk, 'new')
        st.append(f"""INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
VALUES ({lit(old_s)}, {lit(wk)}, {lit(lid)}, {lit(old_from)}::date, {lit(f"work_edition:old {instrs} valid_from={old_from}{'' if eff else ' (تاريخ الإصدار؛ النفاذ غير معلوم)'} valid_to={d['repeal_effective']}")}, NULL, {lit(BY)}),
({lit(new_s)}, {lit(wk)}, {lit(sid)}, {lit(d['repeal_effective'])}::date, {lit(f"work_edition:new {succ_instr} valid_from={d['repeal_effective']} ({ref})")}, {lit(old_s)}, {lit(BY)})""")
        st.append(f"""INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
({lit('smg14-' + h(BY, wk, lid))}, {lit(wk)}, {lit(lid)}, 'edition_old', {lit(BY)}),
({lit('smg14-' + h(BY, wk, sid))}, {lit(wk)}, {lit(sid)}, 'edition_new', {lit(BY)})""")
        guards += [f"(SELECT count(*) FROM search_surface_member WHERE system_id={lit(sid)} OR work_key={lit(wk)})=0",
                   f"(SELECT count(*) FROM search_surface WHERE work_key={lit(wk)})=0"]
        n_surf = 2
    after += [
        f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(lid)} AND coalesce(search_norm,'')<>'')={n_units}",
        f"(SELECT string_agg(encode(sha256(convert_to(a.content,'UTF8')),'hex'), ',' ORDER BY a.\"articleNumber\") FROM legal_articles a WHERE a.\"legalSystemId\"={lit(lid)})"
        f" = (SELECT string_agg(encode(sha256(convert_to(u.body,'UTF8')),'hex'), ',' ORDER BY {NUM}) FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id={lit(lid)}{useq})",
        f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(lid)} ORDER BY verified_at DESC, id DESC LIMIT 1)={lit(status)}",
        f"(SELECT hakeem_system_id FROM boe.current_match WHERE guid={lit(old['guid'])})={lit(lid)}",
        f"(SELECT count(*) FROM legal_systems WHERE id={lit(lid)} AND classification IS NOT NULL)=1",
        f"(SELECT count(*) FROM search_surface_member WHERE system_id={lit(lid)})={n_surf // 2}",
    ]
    plan.append(dict(item=p['item'], boe_id=lid, name=name, status=status, successor=s['name'], repeal_effective=d['repeal_effective'], articles=n_units, same_work=d['same_work']))
    tot_arts += n_units
st.insert(0, f"SELECT CASE WHEN {' AND '.join(guards)} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 THEN 'ok' ELSE {FAIL} END AS guard_before")
st.append(f"SELECT CASE WHEN {' AND '.join(after)} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={tot_arts + len(plan)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {'public.legal_articles': tot_arts, 'public.legal_systems': len(plan)},
           'report': {'systems': len(plan), 'new_articles': tot_arts, 'changed_text': 0, 'plan': plan}, 'statements': st, 'diag_guards': guards},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'systems', len(plan), 'articles', tot_arts)
