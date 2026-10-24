#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045b): تاريخ نفاذ أربع نسخ من قائمة «بلا تاريخ نشر» (HKM-040) من أم القرى.

وُجدت صفحات أربع أدوات في ذاكرة خدمة الجلب لأم القرى (uqn.gov.sa محجوب من خارج المملكة)، وحُفظت في sources/.
الأدوات الأربع ساكتة عن نفاذها فتنفذ بنشرها (المادة 71 من النظام الأساسي للحكم). القرار 307 يعدّل مدة العمل
بالضوابط («بعد (360) يوماً من تاريخ نشرها» أي نشر الضوابط)، وهو نفسه ساكت عن نفاذه فينفذ بنشره.
النمط نفسه في HKM-040: unit_version للإضافة فقط، فتُضاف نسخة «النص السابق» عند تاريخ الصدور + ثانية،
ثم نسخة بالنص المعدّل نفسه عند تاريخ النشر. كل نص يُنسخ داخل القاعدة؛ لا نص قانوني في هذا الملف.

    python3 data/review/hkm045b-uqn-publication-dates-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045b-uqn-publication-dates-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
RULE = 'سكوت الأداة عن النفاذ ← تاريخ النشر في أم القرى (المادة 71 من النظام الأساسي للحكم)'
# vid ← (اسم ملف المصدر، مفتاح الأداة في uqn_dates_found.json)
ITEMS = {
    'hk37wu-5879c3b0f751e76732c7385b': ('cm651_1443_awqaf.md', '(651)'),
    'hk37wu-42c2b2664ab9ba5710359127': ('cm677_1443_geospatial.md', '(677)'),
    'hk37u-6111e8d61d576d4c5eeacd4c': ('cm307_1445_service_suspension.md', '(307)'),
    'hk37u-e04fca523ecfc1d238d6485e': ('ro_a76_1447_ecza.md', '(أ/76)'),
}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def build():
    found = json.loads((D / 'uqn_dates_found.json').read_text(encoding='utf-8'))
    pending = {x['vid']: x for x in json.loads((D.parent / 'hkm040-effective-dates-2026-10-24' / 'pending-publication-date.json').read_text(encoding='utf-8'))}
    vids = ','.join(lit(v) for v in ITEMS)
    st = [f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45b%') = 0 "
          f"AND (SELECT count(*) FROM unit_version v WHERE v.unit_id IN (SELECT unit_id FROM unit_version WHERE id IN ({vids}))) = {len(ITEMS)} "
          f"THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
    report = []
    for vid, (fname, key) in ITEMS.items():
        assert vid in pending, vid
        r = next(x for x in found if key in x['instrument'])
        page = (D / 'sources' / fname).read_text(encoding='utf-8')
        assert r['published_hijri'] in page and r['published_gregorian'] in page, (vid, fname)
        d, m, y = r['published_gregorian'].split('-')
        pub = f'{y}-{m}-{d}'
        assert pub > pending[vid]['current_valid_from'], (vid, pub)
        src = f"(SELECT unit_id, body, valid_from, evidence_instrument FROM unit_version WHERE id = {lit(vid)})"
        prior = "(SELECT content FROM legal_articles WHERE id = s.unit_id)"
        note = f"نُشر في أم القرى {r['published_hijri']}هـ الموافق {pub} ({r['url']}، لقطة sources/{fname})"
        rid = 'hk45br-' + hid('r', vid)
        st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(rid)}, s.unit_id, {prior}, s.valid_from + interval '1 second', s.evidence_instrument, {lit(r['url'])}, {lit(f'النص السابق للمدة بين صدور الأداة ونشرها ({pub})؛ تصحيح تاريخ النسخة {vid} — {RULE}. {note}')}, now()
FROM {src} s WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(rid)})""")
        eid = 'hk45be-' + hid('e', vid, pub)
        quote = f"{RULE}. {note}. {r.get('operative_quote') or ''}"
        st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(eid)}, s.unit_id, s.body, {lit(pub)}::timestamptz, s.evidence_instrument, {lit(r['url'])}, {lit(quote[:1500])}, now()
FROM {src} s WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(eid)})""")
        report.append({'vid': vid, 'law': pending[vid]['law'], 'article': pending[vid]['article'], 'from': pending[vid]['current_valid_from'], 'to': pub, 'url': r['url']})
    # النص الساري اليوم لا يتغير: نسخة النشر نصها نص النسخة الأصلية، وتاريخها قبل اليوم
    post = ' AND '.join(
        f"(SELECT v.body FROM unit_version v WHERE v.unit_id = (SELECT unit_id FROM unit_version WHERE id = {lit(v)}) AND v.valid_from <= now() "
        f"ORDER BY v.valid_from DESC, v.created_at DESC LIMIT 1) = (SELECT body FROM unit_version WHERE id = {lit(v)})" for v in ITEMS)
    st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45b%') = {2 * len(ITEMS)} AND {post} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': report, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    build()
