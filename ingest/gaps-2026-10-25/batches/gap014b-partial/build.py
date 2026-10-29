#!/usr/bin/env python3
"""gap014b (HKM-052، الصنف W2a): إصداران ملغيان استبقى مرسوم خلفهما أحكامًا منهما، بحالة لكل مادة.

المدخل: قراءتا w2a (e، f) للخلف وتاريخ الإلغاء وتاريخ النفاذ القديم، وقراءتا w2a_partial (k، l) للمواد الباقية، وقرار المالك 29/10.
1) النظام العام للبيئة (م/34 لعام 1422هـ): ألغاه مرسوم نظام البيئة (ثانيًا/د) بعد نفاذه في 2021-01-13، واستبقى «الأحكام المتعلقة بالنفايات»
   حتى صدور أحكامها الخاصة: نظام إدارة النفايات (م/3 لعام 1443هـ) النافذ في 2021-11-16 (النشر 1443/2/10هـ + 60 يومًا).
   المواد 1 و12 و14 و18–22 (الباقية كليًا أو جزئيًا عند القارئين) «ملغاة» من 2021-11-16، وسائرها «ملغاة» من 2021-01-13.
   النفايات المشعة في المادة 14: تنظمها المواد 14 و18 و19 من نظام الرقابة على الاستخدامات النووية والإشعاعية (م/82 لعام 1439هـ)،
   فلا يبقى للمادة 14 أثر (اقتراح القسم بطلب المالك 29/10: «ماذا تقترح حسب فهمك»).
2) نظام المنشآت والمستحضرات الصيدلانية (م/31 لعام 1425هـ): حل محله نظام 1441 من 2020-08-22، واستبقى مرسومه (ثالثًا) أحكام
   «الصيدلية ومنشأة بيع المستحضرات العشبية» ولم تصدر أحكامهما بعد. المواد التي اتفق القارئان على بقائها (15) «ساري» في حدود المنشأتين،
   وسائرها «مستبدل» من 2020-08-22 (المالك 29/10: بلا تفضيل، فاختار القسم الأدق).
لكل إصدار: legal_systems، legal_articles (نص لقطة الهيئة)، verification للعمل ولكل مادة، legal_text_provenance (boe)، law_card، boe.match،
ووجه بحث إصدارًا سابقًا لعمل الخلف (edition_old/edition_new). إضافة فقط.

    python3 batches/gap014b-partial/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
G14 = D.parent / 'gap014-old-editions'
BY = 'gap014b-partial-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
NUM = 'coalesce(u.article_number, f.article_number, u.seq)'
WASTE_URL = 'https://www.uqn.gov.sa/details?p=18289'
DECREE_ENV = 'boe26-cac061cf62e7f29ef3afdc79'


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


P = json.load(open(G14 / 'packets.json', encoding='utf-8'))
items = {p['item']: p for p in P['items']}
succ = P['successor_details']
slugs = json.load(open(G14 / 'slugs.json', encoding='utf-8'))
K = {x['law']: x for x in (json.loads(l) for l in open(D.parents[1] / 'readers' / 'readings' / 'w2a_partial' / 'reader_k.jsonl', encoding='utf-8'))}
L = {x['law']: x for x in (json.loads(l) for l in open(D.parents[1] / 'readers' / 'readings' / 'w2a_partial' / 'reader_l.jsonl', encoding='utf-8'))}

ENV_SAVE = 'استثناءً من الفقرة الفرعية (د) من الفقرة (1) من هذا البند، يستمر العمل بالأحكام المتعلقة بالنفايات الواردة في النظام العام للبيئة'
PH_SAVE = 'ثالثاً: استثناءً من أحكام المادة (الحادية والأربعين) من النظام، يستمر العمل بالأحكام المتعلقة بالصيدلية ومنشأة بيع المستحضرات العشبية'
E = [dict(item='W2a-01', name='النظام العام للبيئة الصادر بالمرسوم الملكي رقم (م/34) وتاريخ 1422/7/28هـ', successor='cmpz5qgt5007tcwg20weum23t',
          work_status='ملغى', repeal='2021-01-13', old_from='2002-10-30',
          clause_guard=f"(SELECT count(*) FROM boe.text_block WHERE law_id={lit(DECREE_ENV)} AND kind='royal_decree' AND position({lit('د- النظام العام للبيئة، الصادر بالمرسوم الملكي رقم (م / 34) وتاريخ 28 / 7 / 1422هـ.')} in body)>0 AND position({lit(ENV_SAVE)} in body)>0)>=1",
          ref='البند (ثانيًا/د) من المرسوم الملكي (م/165) بإصدار نظام البيئة', instr='مرسوم ملكي رقم (م/165) وتاريخ 1441/11/19هـ',
          url=(succ['cmpz5qgt5007tcwg20weum23t']['boe'] or [{}])[0].get('url'),
          quote=('البند (ثانيًا) من المرسوم الملكي (م/165): «يلغي نظام البيئة -المشار إليه في البند (أولاً) من هذا المرسوم- بعد نفاذه- ما يلي: … د- النظام العام للبيئة، '
                 'الصادر بالمرسوم الملكي رقم (م / 34) وتاريخ 28 / 7 / 1422هـ.»، و«' + ENV_SAVE + ' … إلى حين صدور الأحكام الخاصة بها، والعمل بموجبها.»؛ '
                 'نفاذ نظام البيئة: النشر 1441/11/26هـ + 180 يومًا = 2021-01-13')),
     dict(item='W2a-14', name='نظام المنشآت والمستحضرات الصيدلانية الصادر بالمرسوم الملكي رقم (م/31) وتاريخ 1425/6/1هـ', successor='cmpz5qz2r00adcwg2tfe62w2s',
          work_status='مستبدل', repeal='2020-08-22', old_from='2004-12-18',
          clause_guard=f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"='cmpz5qz2r00adcwg2tfe62w2s' AND \"articleNumber\"=41 AND \"articleBis\"<100 AND position({lit('يحل النظام محل نظام المنشآت والمستحضرات الصيدلانية')} in content)>0)=1",
          ref='المادة (41) من نظام المنشآت والمستحضرات الصيدلانية والعشبية', instr='مرسوم ملكي رقم (م/108) وتاريخ 1441/8/22هـ',
          url=(succ['cmpz5qz2r00adcwg2tfe62w2s']['boe'] or [{}])[0].get('url'),
          quote=('المادة (41) من نظام المنشآت والمستحضرات الصيدلانية والعشبية: «يحل النظام محل نظام المنشآت والمستحضرات الصيدلانية، الصادر بالمرسوم الملكي رقم (م/31) '
                 'وتاريخ 1 / 6 / 1425هـ، ويلغي كل ما يتعارض معه من أحكام.»؛ والمرسوم (م/108): «' + PH_SAVE + '، المنصوص عليها في نظام المنشآت والمستحضرات الصيدلانية … '
                 'وذلك إلى حين صدور الأحكام الخاصة بهاتين المنشأتين، والعمل بموجبها.»؛ النفاذ: النشر 1441/9/1هـ + 120 يومًا = 2020-08-22'))]


def unit_plan(e):
    law = 'النظام العام للبيئة' if e['item'] == 'W2a-01' else 'نظام المنشآت والمستحضرات الصيدلانية'
    k = {s['n']: s for s in K[law]['surviving_articles']}
    l = {s['n']: s for s in L[law]['surviving_articles']}
    both = sorted(set(k) & set(l))
    plan = {}
    for n in range(1, int(items[e['item']]['old']['units']) + 1):
        if e['item'] == 'W2a-01':
            if n in both:
                part = 'كلها' if k[n]['scope'] == 'كلها' else f"في حدود: {k[n].get('part') or k[n]['reason']}"
                plan[n] = ('ملغاة', '2021-11-16', (f"استُبقيت المادة بالبند (ثانيًا) من المرسوم (م/165) («{ENV_SAVE} … إلى حين صدور الأحكام الخاصة بها، والعمل بموجبها»)، {part}؛ "
                                                   f"وانتهى الاستبقاء بنفاذ نظام إدارة النفايات (م/3 لعام 1443هـ): النشر 1443/2/10هـ + 60 يومًا (م38) = 2021-11-16 ({WASTE_URL})"
                                                   + ('؛ والنفايات الإشعاعية تنظمها المواد 14 و18 و19 من نظام الرقابة على الاستخدامات النووية والإشعاعية (م/82 لعام 1439هـ)' if n == 14 else '')
                                                   + ' [قارئان مستقلان متفقان؛ قرار المالك 29/10]'), 'مرسوم ملكي رقم (م/3) وتاريخ 1443/1/5هـ')
            else:
                plan[n] = ('ملغاة', '2021-01-13', e['quote'] + ' [قارئان مستقلان متفقان]', e['instr'])
        else:
            if n in both:
                part = 'كلها' if k[n]['scope'] == 'كلها' else f"في حدود: {k[n].get('part') or k[n]['reason']}"
                note = (f"باقية بالمرسوم (م/108) ثالثًا («{PH_SAVE} … إلى حين صدور الأحكام الخاصة بهاتين المنشأتين، والعمل بموجبها»)، {part}؛ ولم تصدر تلك الأحكام حتى 2026-10-29"
                        + ('؛ وعلّق المرسوم الملكي (م/195) وتاريخ 3/9/1446هـ شرط سعودية المالك فيها «إلى حين صدور النظام الصحي المتكامل ونفاذه»' if n == 3 else '')
                        + ' [قارئان مستقلان متفقان؛ قرار المالك 29/10]')
                plan[n] = ('ساري', e['old_from'], note, 'مرسوم ملكي رقم (م/108) وتاريخ 1441/8/22هـ، البند (ثالثًا)')
            else:
                plan[n] = ('مستبدل', '2020-08-22', e['quote'] + ' [قارئان مستقلان متفقان]', e['instr'])
    return plan, both


st, guards, after, report = [], [], [], []
tot = 0
for e in E:
    p = items[e['item']]
    old, lid, sid = p['old'], p['boe_id'], e['successor']
    s = succ[sid]
    name, slug = e['name'], slugs[e['name']]
    n_units = int(old['units'])
    instrs = ' '.join(re.sub(r'\s+', ' ', x['text']).strip().rstrip('.') for x in old['instruments'])
    plan, both = unit_plan(e)
    pre = (f"أداة الإصدار:\n{instrs}\nالحالة: {e['work_status']} — {e['ref']}، من {e['repeal']}؛ "
           + ('مع استبقاء أحكام النفايات حتى 2021-11-16' if e['item'] == 'W2a-01' else 'مع بقاء أحكام الصيدلية ومنشأة بيع المستحضرات العشبية')
           + f"\nالمصدر: هيئة الخبراء ({old['url']})")
    guards += [f"(SELECT count(*) FROM boe.law WHERE id={lit(lid)} AND guid={lit(old['guid'])} AND status_at_source='لاغي')=1",
               f"(SELECT count(*) FROM boe.unit u WHERE u.law_id={lit(lid)})={n_units}",
               f"(SELECT count(DISTINCT {NUM}) FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id={lit(lid)})={n_units}",
               f"(SELECT count(*) FROM legal_systems WHERE id={lit(lid)} OR name={lit(name)} OR eli_slug={lit(slug)})=0",
               f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(sid)} ORDER BY verified_at DESC, id DESC LIMIT 1)='ساري'",
               f"(SELECT count(*) FROM search_surface_member WHERE system_id={lit(sid)} OR work_key={lit('we:' + sid)})=0",
               e['clause_guard']]
    st.append(f"""INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind)
SELECT {lit(lid)}, {lit(name)}, o.classification, {n_units}, now(), now(), o.domain, o.domain_title, 0, {lit(slug)}, {lit(pre)}, {lit(instrs)}, {lit(e['old_from'])}::timestamp, now(), 'نظام'
FROM legal_systems o WHERE o.id={lit(sid)}""")
    st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT 'boe26-'||left(encode(sha256(convert_to(l.id||'|article|'||{NUM},'UTF8')),'hex'),24), l.id, s.name, s.classification, {NUM}, 0,
  coalesce(nullif(btrim(rtrim(u.heading, ':')),''), 'المادة '||{NUM}), u.body, {lit(instrs)}, NULL,
  CASE WHEN {NUM} IN ({','.join(str(n) for n in both) or '0'}) AND {lit(e['item'])}='W2a-14' THEN 'سارية' ELSE 'ملغاة' END, now(), now(),
  uqn_fix.hkm30_search_norm(s.name, coalesce(nullif(btrim(rtrim(u.heading, ':')),''), 'المادة '||{NUM}), u.body, ARRAY[]::text[], s.classification, NULL)
FROM boe.law l JOIN legal_systems s ON s.id=l.id JOIN boe.unit u ON u.law_id=l.id LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE l.id={lit(lid)} ORDER BY u.seq""")
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES ({lit('vfg14b-' + h(BY, 'work', lid))}, 'work', {lit(lid)}, {lit(e['work_status'])}, {lit(e['instr'] + ' — ' + e['ref'] + ' — من ' + e['repeal'])}, {lit(e['url'] or old['url'])}, {lit(e['quote'] + ' [قارئان مستقلان متفقان، HKM-052]')}, 'owner_decision', {lit(BY)}, NULL)""")
    vals = ',\n'.join(f"({n}, {lit(st_)}, {lit(ins + ' — من ' + dt)}, {lit(q)})" for n, (st_, dt, q, ins) in sorted(plan.items()))
    st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg14b-'||left(encode(sha256(convert_to({lit(BY)}||'|unit|'||a.id,'UTF8')),'hex'),24), 'unit', a.id, v.st, v.ins, {lit(old['url'])}, v.q, 'owner_decision', {lit(BY)}, NULL
FROM legal_articles a JOIN (VALUES
{vals}
) AS v(n, st, ins, q) ON v.n=a."articleNumber" WHERE a."legalSystemId"={lit(lid)}""")
    st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text)
SELECT {lit('g14bp-' + h(BY, lid, 'system'))}, 'system', {lit(lid)}, {lit(name)}, NULL, 'boe', {lit('boe:' + old['guid'])}, {lit(old['url'])}, NULL, DATE '2026-09-28', 'insert:boe_snapshot', NULL
UNION ALL
SELECT 'g14bp-'||left(encode(sha256(convert_to({lit(BY)}||'|'||a.id,'UTF8')),'hex'),24), 'article', a.id, {lit(name)}, a."articleNumber", 'boe', {lit('boe:' + old['guid'])}, {lit(old['url'])},
  encode(sha256(convert_to(a.content,'UTF8')),'hex'), DATE '2026-09-28', 'insert:boe_snapshot', NULL FROM legal_articles a WHERE a."legalSystemId"={lit(lid)}""")
    st.append(f"""INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT {lit('lc14b-' + h(BY, lid))}, l.id, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, l.status_at_source, l.category_path, l.instruments,
  coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) FROM boe.text_block b WHERE b.law_id=l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28', {lit(BY)}
FROM boe.law l WHERE l.id={lit(lid)}""")
    st.append(f"""INSERT INTO boe.match (id, guid, hakeem_system_id, method, candidates, decided_by, decided_at)
VALUES ({lit('g14bm-' + h(BY, old['guid'])[:19])}, {lit(old['guid'])}, {lit(lid)}, 'owner', jsonb_build_object('basis', {lit('gap014b (HKM-052): الإصدار مُدخل من لقطة الهيئة بحالة لكل مادة؛ ' + e['ref'])}), {lit(BY)}, now())""")
    wk = f'we:{sid}'
    o_s, n_s = 'ssg14b-' + h(BY, wk, 'old'), 'ssg14b-' + h(BY, wk, 'new')
    st.append(f"""INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
VALUES ({lit(o_s)}, {lit(wk)}, {lit(lid)}, {lit(e['old_from'])}::date, {lit(f"work_edition:old {instrs} valid_from={e['old_from']} valid_to={e['repeal']}")}, NULL, {lit(BY)}),
({lit(n_s)}, {lit(wk)}, {lit(sid)}, {lit(e['repeal'])}::date, {lit(f"work_edition:new {e['instr']} valid_from={e['repeal']} ({e['ref']})")}, {lit(o_s)}, {lit(BY)})""")
    st.append(f"""INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
({lit('smg14b-' + h(BY, wk, lid))}, {lit(wk)}, {lit(lid)}, 'edition_old', {lit(BY)}),
({lit('smg14b-' + h(BY, wk, sid))}, {lit(wk)}, {lit(sid)}, 'edition_new', {lit(BY)})""")
    cnt = {}
    for st_, *_ in plan.values():
        cnt[st_] = cnt.get(st_, 0) + 1
    after += [f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(lid)} AND coalesce(search_norm,'')<>'')={n_units}",
              f"(SELECT string_agg(encode(sha256(convert_to(a.content,'UTF8')),'hex'), ',' ORDER BY a.\"articleNumber\") FROM legal_articles a WHERE a.\"legalSystemId\"={lit(lid)})"
              f" = (SELECT string_agg(encode(sha256(convert_to(u.body,'UTF8')),'hex'), ',' ORDER BY {NUM}) FROM boe.unit u LEFT JOIN boe.unit_number_fix f ON f.law_id=u.law_id AND f.seq=u.seq WHERE u.law_id={lit(lid)})"]
    after += [f"(SELECT count(*) FROM legal_articles a WHERE a.\"legalSystemId\"={lit(lid)} AND (SELECT v.verified_status FROM verification v WHERE v.object_type='unit' AND v.object_id=a.id ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)={lit(k)})={c}" for k, c in cnt.items()]
    report.append(dict(item=e['item'], boe_id=lid, name=name, work_status=e['work_status'], articles=n_units, unit_status=cnt, surviving=both))
    tot += n_units
st.insert(0, f"SELECT CASE WHEN {' AND '.join(guards)} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 THEN 'ok' ELSE {FAIL} END AS guard_before")
st.append(f"SELECT CASE WHEN {' AND '.join(after)} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={tot + len(E)} AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})=4 THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {'public.legal_articles': tot, 'public.legal_systems': len(E)},
           'report': {'systems': len(E), 'new_articles': tot, 'changed_text': 0, 'plan': report}, 'statements': st, 'diag_guards': guards},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), json.dumps(report, ensure_ascii=False))
