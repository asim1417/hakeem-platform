#!/usr/bin/env python3
"""gap013 (HKM-052، الصنف U4b): المواد 103–137 (أحكام الإفلاس) من نظام المحكمة التجارية، ألغتها المادة (230) من نظام الإفلاس.

- نص الإلغاء (حكيم، المادة 230 من نظام الإفلاس م/50 وتاريخ 1439/5/28هـ): «يلغي النظام أحكام المواد من (103) إلى (137) من نظام
  المحكمة التجارية، الصادر بالأمر الملكي رقم (32) وتاريخ 1350/1/15هـ …». الأرقام منصوصة، فلا حاجة إلى حدود باب.
- الهوية: نظام المحكمة التجارية في حكيم (cmpz5piul0031cwg22r65v5gr) هو سجل بطاقة الهيئة الحالية (boe.current_match).
  وحدود النص تؤكدها المواد نفسها: 103 «المفلس من استغرقت الديون…» و137 «المفلس تقصيرا يعاقب…»، و102 في السفاتج و138 في البيع.
- النفاذ: المادة (231): «ويعمل به اعتباراً من تاريخ صدور اللائحة على ألا يتجاوز (مائة وثمانين يوماً) من تاريخ نشره»؛
  النشر 1439/6/7هـ (بطاقة نظما)، واللائحة صدرت بعده (قرار مجلس الوزراء 622 وتاريخ 1439/12/24هـ).
  قرار المالك 29/10/2026: يُعتمد 1439/12/7هـ (2018-08-18)، التاريخ الذي أعلنته لجنة الإفلاس وطُبّق.
- المواد الـ35 بلا حالة الآن وبلا نسخ (unit_version)، فلا يُستبدل صف. إضافة فقط: 35 صف verification «ملغاة». لا UPDATE ولا DELETE.

    python3 batches/gap013-bankruptcy-repeal/build.py
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap013-bankruptcy-repeal-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
REP_SYS, REP_ART, REP_MD5, REP_PRE_MD5 = 'cmpz5pmxa003lcwg2gvi5rlyr', 'cmpz6dlkf079tcwg2d4xnp0lc', '6d53eb8fb23e17ecaa4abf1dc77a0bfc', '3317f3668cc782ee188ae0bada042718'
EFF_ART, EFF_MD5 = 'cmpz6dlqd079vcwg2diunnii0', 'f2f1bdea307e626444ef219e2f72a280'
REP_GUID = '68204119-84f1-4789-8fad-a9ec014c3788'
REP_URL = f'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/{REP_GUID}/1'
TGT_SYS, TGT_PRE_MD5, TGT_BOE = 'cmpz5piul0031cwg22r65v5gr', '6ff15f53e6b4e781c35fcc03800b94e4', 'boe26-c2c55692a8370a93973edd29'
LO, HI, N = 103, 137, 35
SET_MD5, TEXT_MD5 = '9c49bea546d81633f92a07b74e466cee', '6afdff250c9cbef4d698d43c2dcc33cc'
EFF = '2018-08-18'
DEAD = "('ملغاة','ملغى','مستبدل')"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def last_unit(col, ref):
    return f"(SELECT v.{col} FROM verification v WHERE v.object_type='unit' AND v.object_id={ref} ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)"


def last_work(i):
    return f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(i)} ORDER BY verified_at DESC, id DESC LIMIT 1)"


pred = f"x.\"legalSystemId\"={lit(TGT_SYS)} AND x.\"articleBis\"<100 AND x.\"articleNumber\" BETWEEN {LO} AND {HI}"
method = ('أرقام المواد منصوصة في عبارة الإلغاء (103–137)؛ الهوية: نظام المحكمة التجارية (الأمر 32 وتاريخ 15/1/1350هـ) هو هذا السجل بمطابقة بطاقة الهيئة الحالية؛ '
          'النفاذ: المادة (231): «ويعمل به اعتباراً من تاريخ صدور اللائحة على ألا يتجاوز (مائة وثمانين يوماً) من تاريخ نشره»، والنشر 1439/6/7هـ، '
          'واللائحة صدرت بعده بقرار مجلس الوزراء (622) وتاريخ 1439/12/24هـ؛ '
          f'قرار المالك 29/10/2026: يُعتمد 1439/12/7هـ ({EFF})، التاريخ الذي أعلنته لجنة الإفلاس وطُبّق')
c = [
    f"(SELECT count(*) FROM legal_articles WHERE id={lit(REP_ART)} AND \"legalSystemId\"={lit(REP_SYS)} AND \"articleNumber\"=230 AND \"articleBis\"=0 AND md5(content)={lit(REP_MD5)})=1",
    f"(SELECT count(*) FROM legal_articles WHERE id={lit(EFF_ART)} AND \"legalSystemId\"={lit(REP_SYS)} AND \"articleNumber\"=231 AND \"articleBis\"=0 AND md5(content)={lit(EFF_MD5)})=1",
    f"(SELECT count(*) FROM legal_systems WHERE id={lit(REP_SYS)} AND name={lit('نظام الإفلاس')} AND md5(coalesce(preamble,''))={lit(REP_PRE_MD5)} AND btrim(coalesce(substring(preamble_royal_decree from '^(.*?هـ)'),''))<>'')=1",
    f"{last_work(REP_SYS)}={lit('ساري')}",
    f"(SELECT count(*) FROM legal_systems WHERE id={lit(TGT_SYS)} AND md5(coalesce(preamble,''))={lit(TGT_PRE_MD5)})=1",
    f"coalesce({last_work(TGT_SYS)},'') NOT IN {DEAD}",
    f"(SELECT hakeem_system_id FROM boe.current_match WHERE guid=(SELECT guid FROM boe.law WHERE id={lit(TGT_BOE)}))={lit(TGT_SYS)}",
    f"(SELECT hakeem_system_id FROM boe.current_match WHERE guid={lit(REP_GUID)})={lit(REP_SYS)}",
    f"(SELECT count(*) FROM legal_articles x WHERE {pred})={N}",
    f"(SELECT md5(string_agg(x.id, '|' ORDER BY x.\"articleNumber\", x.\"articleBis\")) FROM legal_articles x WHERE {pred})={lit(SET_MD5)}",
    f"(SELECT md5(string_agg(md5(x.content), '|' ORDER BY x.\"articleNumber\", x.\"articleBis\")) FROM legal_articles x WHERE {pred})={lit(TEXT_MD5)}",
    f"(SELECT count(*) FROM legal_articles x WHERE {pred} AND {last_unit('id', 'x.id')} IS NOT NULL)=0",
    f"(SELECT count(*) FROM legal_articles x JOIN unit_version uv ON uv.unit_id=x.id WHERE {pred})=0",
    f"(SELECT count(*) FROM boe.unit WHERE law_id={lit(TGT_BOE)} AND article_number BETWEEN {LO} AND {HI})={N}",
    f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0",
]
st = [f"SELECT CASE WHEN {' AND '.join(c)} THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id) SELECT 'vfg13-'||left(encode(sha256(convert_to({lit(BY)}||'|'||x.id||'|ملغاة','UTF8')),'hex'),24), 'unit', x.id, 'ملغاة', btrim(substring(s.preamble_royal_decree from '^(.*?هـ)'))||' — المادة ('||r."articleNumber"||') من '||s.name||' — من '||{lit(EFF)}, {lit(REP_URL)}, 'المادة ('||r."articleNumber"||') من '||s.name||': «'||btrim(r.content)||'»'||' [منهج HKM-052: '||{lit(method)}||']', 'owner_decision', {lit(BY)}, NULL FROM legal_articles x JOIN legal_articles r ON r.id={lit(REP_ART)} JOIN legal_systems s ON s.id=r."legalSystemId" WHERE {pred} ORDER BY x."articleNumber", x."articleBis\"""")
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={N} AND (SELECT count(*) FROM legal_articles x WHERE {pred} AND {last_unit('verified_status', 'x.id')}='ملغاة' AND {last_unit('verified_by', 'x.id')}={lit(BY)})={N} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'rows': N, 'articles': f'{LO}–{HI}', 'effective_from': EFF, 'method': method,
                                                                                 'new_articles': 0, 'changed_text': 0, 'changed_status': N}, 'statements': st},
          open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
