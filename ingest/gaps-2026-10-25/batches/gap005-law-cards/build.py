#!/usr/bin/env python3
"""gap005 (HKM-048، الصنف M4): بطاقة نظام (law_card) من بطاقة الهيئة المطابَقة لثلاثة أنظمة بلا بطاقة.
نمط hkm045e (from_boe): نسخ boe.law وكتل نصها كما هي. الهوية: المطابقة الحالية boe.current_match، وأداة الإصدار
في ديباجة حكيم = أداة الهيئة، وعدد المواد متساوٍ (20، 15، 21).
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap005-law-cards-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
COLS = "id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by"
ROWS = [('cmpz5r4w400b7cwg205r4it34', 'boe26-208aa8ca287f99e300505496', 20),
        ('cmpz5q4yq0065cwg21c3dn066', 'boe26-25f85d5347ca67980e776fad', 15),
        ('b34f149ba7e54f1ca92e299fb6306460', 'boe26-32bfe3acd7582c443eec1770', 21)]
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
pre, st = [], []
for sid, law, n in ROWS:
    cid = 'lcg5-' + hashlib.sha256(f'{BY}|{sid}'.encode()).hexdigest()[:24]
    pre += [f"(SELECT hakeem_system_id FROM boe.current_match WHERE guid = (SELECT guid FROM boe.law WHERE id = {lit(law)})) = {lit(sid)}",
            f"(SELECT status_at_source FROM boe.law WHERE id = {lit(law)}) = 'ساري'",
            f"(SELECT article_count FROM boe.law WHERE id = {lit(law)}) = {n}",
            f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\" = {lit(sid)} AND \"articleBis\" < 100) = {n}",
            f"(SELECT count(*) FROM law_card WHERE system_id = {lit(sid)}) = 0"]
    st.append(f"INSERT INTO law_card ({COLS}) SELECT {lit(cid)}, {lit(sid)}, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, "
              f"l.status_at_source, l.category_path, l.instruments, coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) "
              f"FROM boe.text_block b WHERE b.law_id = l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28'::date, {lit(BY)} FROM boe.law l WHERE l.id = {lit(law)}")
pre.append(f"(SELECT count(*) FROM law_card WHERE created_by = {lit(BY)}) = 0")
st = [f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {FAIL} END AS guard_before"] + st + [
     f"SELECT CASE WHEN (SELECT count(*) FROM law_card WHERE created_by = {lit(BY)}) = {len(ROWS)} AND (SELECT count(DISTINCT system_id) FROM law_card WHERE created_by = {lit(BY)}) = {len(ROWS)} THEN 'ok' ELSE {FAIL} END AS guard_after"]
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'statements': st}, open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5); print(json.dumps(st, ensure_ascii=False))
