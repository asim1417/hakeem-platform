#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045e، البند 12): تصحيح بطاقات الأنظمة (law_card) المعتمدة في ملاحظات المراقب.

law_card للإضافة فقط، و«آخر صف لكل system_id هو البطاقة» (created_at DESC, id DESC في الكود والهجرة)،
فالتصحيح بإضافة بطاقة صحيحة لا بحذف أو فصل:
- الرهن التجاري cmpz5peyx… (f09): آخر بطاقة الآن للنظام اللاغي 1424؛ تُضاف نسخة من بطاقة الساري lc26-5a24…
  بأداة قرار مجلس الوزراء (426) مقطوعةً داخل القاعدة من boe.text_block (seq 4)، بدل عنصرين «other» مكررين.
  رقم المرسوم غير مخزن في أي مصدر فلا يُضاف.
- صندوق الاستثمارات العامة (f11) والمنافسة (f10): البطاقة الساريّة هي الأخيرة بفارق المعرّف فقط (نفس created_at)؛
  تُضاف نسخة منها لتتقدم بالتاريخ على بطاقة الملغى.
- التأمينات الاجتماعية cmpz5r6zj… (f03): البطاقة الوحيدة لنظام 1445 مستقل؛ تُضاف بطاقة من boe.law للنظام 1421
  (المطابقة الحالية boe.current_match).
- نظام التنفيذ 1433 ed25-d629… (f14): بلا بطاقة؛ تُضاف من boe.law. ومعها الاسم المرادف «نظام التنفيذ 1433هـ» (f15)
  من boe.law.name، ولا يُضاف «نظام التنفيذ» المجرد لالتباسه بنظام م/237.
- المرافعات أمام ديوان المظالم (f15/23) وضريبة القيمة المضافة (f16): تُضاف أداة قرار مجلس الوزراء (١٣) و(٦٥٤)
  مقطوعةً من ديباجة المرسوم المخزنة (boe.text_block seq 4).
بلا إجراء: البطاقات المكررة المتطابقة (f16/23، f12، f13) — الأخيرة مطابقة للمُبقاة فلا أثر للتكرار.

    python3 data/review/hkm045e-law-cards-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045e-law-cards-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
RAHN, PIF, COMP, SOC, ENF = 'cmpz5peyx002hcwg2i0z53bv9', 'cmpz5pd150027cwg25aec1hlf', 'cmpz5pf5v002icwg2mt8tagez', 'cmpz5r6zj00bbcwg225jusnib', 'ed25-d62948bc9ac1a3c3fb813076'
GRIEV, VAT = 'cmpwi0cqc0023nxffazpywp3a', 'cmpz5pmcd003icwg2ojh0stmz'
# النظام ← (البطاقة الأخيرة الآن أو None، البطاقة الجديدة)
LATEST_NOW = {RAHN: 'lc26-88fc207781f43e33e29a96d7', PIF: 'lc26-b49fafda4ffbc067fc17a1ee', COMP: 'lc26-3ec95510212a447f6c5a0c41',
              SOC: 'lc26-abe0589085e334b38e658461', ENF: None, GRIEV: 'lc26-1dacdc58e4aaffbb7c7c092a', VAT: 'lc26-d2f601dd7da14433de43ff61'}
COLS = "id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def nid(sid):
    return 'lc45-' + hashlib.sha256(f'{BY}|{sid}'.encode()).hexdigest()[:24]


def latest(sid):
    return f"(SELECT id FROM law_card WHERE system_id = {lit(sid)} ORDER BY created_at DESC, id DESC LIMIT 1)"


def tb(law_id, num_re):
    pat = lit('قرار مجلس الوزراء رقم \\(' + num_re + '\\)[^.]*')
    return f"(SELECT substring(b.body from {pat}) FROM boe.text_block b WHERE b.law_id = {lit(law_id)} AND b.seq = 4)"


def instr_obj(law_id, num_re):
    return f"jsonb_build_array(jsonb_build_object('kind', 'cabinet_decision', 'text', {tb(law_id, num_re)}))"


def copy_card(sid, src, instruments='c.instruments'):
    return (f"INSERT INTO law_card ({COLS})\nSELECT {lit(nid(sid))}, c.system_id, c.official_name, c.summary, c.issued_hijri, c.issued_gregorian, c.published_hijri, "
            f"c.published_gregorian, c.status_at_source, c.category_path, {instruments}, c.text_blocks, c.source_name, c.source_url, c.retrieved_on, {lit(BY)}\n"
            f"FROM law_card c WHERE c.id = {lit(src)} AND c.system_id = {lit(sid)}")


def from_boe(sid, law_id):
    return (f"INSERT INTO law_card ({COLS})\nSELECT {lit(nid(sid))}, {lit(sid)}, l.name, l.summary, l.issued_hijri, l.issued_gregorian, l.published_hijri, l.published_gregorian, "
            f"l.status_at_source, l.category_path, l.instruments, coalesce((SELECT jsonb_agg(jsonb_build_object('kind', b.kind, 'text', b.body, 'heading', b.heading) ORDER BY b.seq) "
            f"FROM boe.text_block b WHERE b.law_id = l.id), '[]'::jsonb), 'هيئة الخبراء بمجلس الوزراء', l.url, '2026-09-28'::date, {lit(BY)}\n"
            f"FROM boe.law l WHERE l.id = {lit(law_id)}")


def build():
    pre = [f"{latest(s)} = {lit(c)}" if c else f"{latest(s)} IS NULL" for s, c in LATEST_NOW.items()]
    pre += [f"{tb('boe26-d2db6a7fc364846aaa4370a0', '426')} IS NOT NULL", f"{tb('boe26-e1f3a1fa8f6c4ed4f39f0c58', '١٣')} IS NOT NULL",
            f"{tb('boe26-9625ee2b885f02e9451f93bd', '٦٥٤')} IS NOT NULL",
            "(SELECT hakeem_system_id FROM boe.current_match WHERE guid = (SELECT guid FROM boe.law WHERE id = 'boe26-c74a53d734ed37675a0d36d1')) = " + lit(SOC),
            "(SELECT status_at_source FROM boe.law WHERE id = 'boe26-c74a53d734ed37675a0d36d1') = 'ساري'",
            "(SELECT status_at_source FROM boe.law WHERE id = 'boe26-f64cf8a3131363fb19465efd') = 'ساري'",
            f"(SELECT count(*) FROM legal_system_alias WHERE system_id = {lit(ENF)}) = 0",
            f"(SELECT count(*) FROM law_card WHERE created_by = {lit(BY)}) = 0"]
    st = [f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before",
          copy_card(RAHN, 'lc26-5a24da1db500c6635394afc1', instr_obj('boe26-d2db6a7fc364846aaa4370a0', '426')),
          copy_card(PIF, 'lc26-b49fafda4ffbc067fc17a1ee'),
          copy_card(COMP, 'lc26-3ec95510212a447f6c5a0c41'),
          from_boe(SOC, 'boe26-c74a53d734ed37675a0d36d1'),
          from_boe(ENF, 'boe26-f64cf8a3131363fb19465efd'),
          copy_card(GRIEV, 'lc26-1dacdc58e4aaffbb7c7c092a', 'c.instruments || ' + instr_obj('boe26-e1f3a1fa8f6c4ed4f39f0c58', '١٣')),
          copy_card(VAT, 'lc26-d2f601dd7da14433de43ff61', 'c.instruments || ' + instr_obj('boe26-9625ee2b885f02e9451f93bd', '٦٥٤')),
          f"INSERT INTO legal_system_alias (id, system_id, alias, created_at)\nSELECT {lit('al45-' + hashlib.sha256(f'{BY}|{ENF}|alias'.encode()).hexdigest()[:24])}, {lit(ENF)}, l.name, now() "
          f"FROM boe.law l WHERE l.id = 'boe26-f64cf8a3131363fb19465efd'"]
    post = [f"{latest(s)} = {lit(nid(s))}" for s in LATEST_NOW]
    post += [f"(SELECT jsonb_array_length(instruments) FROM law_card WHERE id = {lit(nid(RAHN))}) = 1",
             f"(SELECT count(*) FROM law_card WHERE id = {lit(nid(SOC))} AND issued_hijri LIKE '1421%') = 1",
             f"(SELECT count(*) FROM legal_system_alias WHERE system_id = {lit(ENF)} AND alias = 'نظام التنفيذ 1433هـ') = 1"]
    st.append(f"SELECT CASE WHEN {' AND '.join(post)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': {'law_cards': 7, 'aliases': 1, 'no_action_identical_duplicates': 3},
                                                   'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5)


if __name__ == '__main__':
    build()
