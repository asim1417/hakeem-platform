#!/usr/bin/env python3
"""gap007 (HKM-048، الصنف U4b/U4a): الباب الثاني (التجارة البحرية) من نظام المحكمة التجارية، ألغته المادة (391) من النظام البحري التجاري.

- نص الإلغاء (حكيم، المادة 391): «… ويلغي الباب الثاني من نظام المحكمة التجارية، الصادر بالمرسوم الملكي رقم (32) وتاريخ 15/1/1350هـ …».
- حدود الباب بلا علامات أبواب في حكيم، فتُثبت بأدلة الهيئة والنص معًا (قارئان مستقلان، readers/readings/round1):
  أول الباب 150 (أول أحكام السفن، والهيئة تشطبه ولا تشطب 149)، وآخره 431؛ والمادة 432 أول الباب الثالث بحاشية الهيئة
  «تم إلغاء هذا الباب الثالث…». المجموع 283 صفًا (282 مادة و169 مكرر).
- النفاذ: المادة (391) «بعد مائة وثمانين يوماً من تاريخ نشره»، والنشر 1440/04/28هـ (2019-01-04) في بطاقة الهيئة
  (يختلف عن تاريخ الإصدار 1440/04/05هـ) → 2019-07-03 بالعدّ المعتمد في HKM-024 وgap001.
- 169 مكرر آخر حالته «ساري» (owner-inject-hkm037-item1)، ويُستبدل بصف «ملغاة» يشير إليه (supersedes)؛ ولا يُحذف شيء.
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap007-maritime-part-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
REP_SYS, REP_ART, REP_MD5, REP_PRE_MD5 = 'cmpz5rxhh00dgcwg2s5sjwrc5', 'cmpzcvf6p0cm0vtrk1v1i6xfo', '1e2db211ff40cb919e121a422f010b5d', 'fa45e1594d93559c86a8142648e3381b'
REP_GUID, REP_URL = '43344715-1e0d-4e7f-9895-aa3d00f670e6', 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/43344715-1e0d-4e7f-9895-aa3d00f670e6/1'
TGT_SYS, TGT_PRE_MD5, TGT_BOE = 'cmpz5piul0031cwg22r65v5gr', '6ff15f53e6b4e781c35fcc03800b94e4', 'boe26-c2c55692a8370a93973edd29'
LO, HI, N, SET_MD5 = 150, 431, 283, 'd1d2a932717cea45ca7ea61e944725bd'
EFF = '2019-07-03'
DEAD = "('ملغاة','ملغى','مستبدل')"
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
def last_unit(col, ref):
    return f"(SELECT v.{col} FROM verification v WHERE v.object_type='unit' AND v.object_id={ref} ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)"
def last_work(i):
    return f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(i)} ORDER BY verified_at DESC, id DESC LIMIT 1)"
pred = f"x.\"legalSystemId\"={lit(TGT_SYS)} AND x.\"articleBis\"<100 AND x.\"articleNumber\" BETWEEN {LO} AND {HI}"
method = (f'حدود الباب الثاني (التجارة البحرية) {LO}–{HI} ومعها 169 مكرر: أول الباب أول أحكام السفن وتشطبه الهيئة ولا تشطب 149، '
          'وحاشية الهيئة على المادة 432: «تم إلغاء هذا الباب الثالث» تجعلها أول الباب الثالث، وعنوانا البابين في النص المقروء من «أصل الوثيقة» في لقطة الهيئة: '
          '«الباب الثاني في التجارة البحرية» بين 149 و150 و«الباب الثالث» بعد 431، و169 مكرر أُضيفت «على أحكام الفصل الثاني من الباب الثاني» (قارئان مستقلان ومراجع)؛ '
          'تاريخ النفاذ: المادة (391): «بعد مائة وثمانين يوماً من تاريخ نشره في الجريدة الرسمية»، والنشر 1440/04/28هـ (2019-01-04) في بطاقة هيئة الخبراء، '
          f'فالنفاذ {EFF} بالعدّ المعتمد في HKM-024؛ الهوية: نظام المحكمة التجارية (الأمر 32 وتاريخ 15/1/1350هـ) هو هذا السجل بمطابقة بطاقة الهيئة الحالية')
c = [
    f"(SELECT count(*) FROM legal_articles WHERE id={lit(REP_ART)} AND \"legalSystemId\"={lit(REP_SYS)} AND \"articleNumber\"=391 AND \"articleBis\"=0 AND md5(content)={lit(REP_MD5)})=1",
    f"(SELECT count(*) FROM legal_systems WHERE id={lit(REP_SYS)} AND name={lit('النظام البحري التجاري')} AND md5(coalesce(preamble,''))={lit(REP_PRE_MD5)} AND btrim(coalesce(substring(preamble_royal_decree from '^(.*?هـ)'),''))<>'')=1",
    f"{last_work(REP_SYS)}={lit('ساري')}",
    f"(SELECT count(*) FROM legal_systems WHERE id={lit(TGT_SYS)} AND md5(coalesce(preamble,''))={lit(TGT_PRE_MD5)})=1",
    f"coalesce({last_work(TGT_SYS)},'') NOT IN {DEAD}",
    f"(SELECT hakeem_system_id FROM boe.current_match WHERE guid=(SELECT guid FROM boe.law WHERE id={lit(TGT_BOE)}))={lit(TGT_SYS)}",
    f"(SELECT count(*) FROM legal_articles x WHERE {pred})={N}",
    f"(SELECT md5(string_agg(x.id, '|' ORDER BY x.\"articleNumber\", x.\"articleBis\")) FROM legal_articles x WHERE {pred})={lit(SET_MD5)}",
    f"(SELECT count(*) FROM legal_articles x WHERE {pred} AND coalesce({last_unit('verified_status','x.id')},'') IN {DEAD})=0",
    f"(SELECT count(*) FROM legal_articles x JOIN unit_version uv ON uv.unit_id=x.id WHERE {pred})=0",
    f"(SELECT count(*) FROM boe.law WHERE guid={lit(REP_GUID)})=1",
    f"(SELECT published_gregorian::date FROM boe.law WHERE guid={lit(REP_GUID)})='2019-01-04'::date",
    f"(SELECT published_gregorian::date + 180 FROM boe.law WHERE guid={lit(REP_GUID)})={lit(EFF)}::date",
    f"(SELECT count(*) FROM boe.unit WHERE law_id={lit(TGT_BOE)} AND article_number={LO} AND css_class LIKE '%canceled%')=1",
    f"(SELECT count(*) FROM boe.unit WHERE law_id={lit(TGT_BOE)} AND article_number={LO - 1} AND coalesce(css_class,'') NOT LIKE '%canceled%')=1",
    f"(SELECT count(*) FROM boe.amendment_note n JOIN boe.unit u ON u.law_id=n.law_id AND u.seq=n.unit_seq WHERE n.law_id={lit(TGT_BOE)} AND u.article_number={HI + 1} AND n.note_text LIKE '%الباب الثالث%')>=1",
    f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0",
]
st = [f"SELECT CASE WHEN {' AND '.join(c)} THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id) SELECT 'vfg7-'||left(encode(sha256(convert_to({lit(BY)}||'|'||x.id||'|ملغاة','UTF8')),'hex'),24), 'unit', x.id, 'ملغاة', btrim(substring(s.preamble_royal_decree from '^(.*?هـ)'))||' — المادة ('||r."articleNumber"||') من '||s.name||' — من '||{lit(EFF)}, {lit(REP_URL)}, 'المادة ('||r."articleNumber"||') من '||s.name||': «'||btrim(r.content)||'»'||' [منهج HKM-048: '||{lit(method)}||']', 'rule', {lit(BY)}, {last_unit('id','x.id')} FROM legal_articles x JOIN legal_articles r ON r.id={lit(REP_ART)} JOIN legal_systems s ON s.id=r."legalSystemId" WHERE {pred} ORDER BY x."articleNumber", x."articleBis\"""")
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={N} AND (SELECT count(*) FROM legal_articles x WHERE {pred} AND {last_unit('verified_status','x.id')}='ملغاة')={N} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'runner': 'run_sql_transaction (معاملة واحدة بعد بروفة على فرع ونقطة استرجاع)', 'report': {'rows': N, 'articles': f'{LO}–{HI} + 169 مكرر', 'effective_from': EFF, 'method': method}, 'statements': st},
          open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5)
