#!/usr/bin/env python3
"""HKM-037 البند 1 — يحوّل قرارات المالك في item1-decisions.xlsx إلى statements.json (إضافة فقط).

  python3 build_statements.py [--assume-approved أ,ب,ج,د]   # الافتراض للتجربة على فرع Neon فقط، لا للإنتاج

لكل صف عليه «موافق» أو «موافق مع تصحيح»:
  - boe.review_proposal (اقتراح موثّق) + boe.owner_decision (قرار المالك).
  - أ ظاهر في حكيم / د لا يمس النص: verification(unit) «ساري» بدليل الأداة.
  - ج إلغاء مادة: verification(unit) «ملغاة» بدليل الأداة.
  - ب نص جديد: unit_version بالنص المركّب (أو المصحّح في «ملاحظته») وتاريخ الأداة، ثم verification «ساري».
«مرفوض» و«مؤجل»: owner_decision فقط. صفوف و وهـ: لا أثر نصي حتى يُركَّب نصها ويُعتمد.
كل عبارة محروسة: لا تُدرج إن وُجد الصف نفسه، والبصمة (md5) تُطبع لمطابقتها بعد التنفيذ.
"""
import argparse, hashlib, json, pathlib, re, sys, warnings
from openpyxl import load_workbook

warnings.filterwarnings('ignore')
from hijri_converter import Hijri

D = pathlib.Path(__file__).parent
BY = 'owner-inject-hkm037-item1-2026-10-23'
RUN = 'hkm037-item1-2026-10-23'
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def q(s):
    return 'NULL' if s is None else '$hk$' + str(s).replace('$hk$', '$hk $') + '$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(map(str, p)).encode()).hexdigest()[:24]


def greg(h):
    m = re.search(r'(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})', (h or '').translate(AR))
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.search(r'(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', (h or '').translate(AR))
        if not m:
            return None
        d, mo, y = map(int, m.groups())
    try:
        return Hijri(y, mo, d).to_gregorian().isoformat()
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--assume-approved', default='')
    a = ap.parse_args()
    assume = set(filter(None, a.assume_approved.split(',')))
    props = {r['note_id']: r for r in json.load(open(D / 'item1-proposals.json', encoding='utf-8'))}
    wb = load_workbook(D / 'item1-decisions.xlsx')
    stmts, report = [], {'proposal': 0, 'decision': 0, 'verification': 0, 'unit_version': 0, 'skipped_no_date': [], 'skipped_no_article': []}
    for ws in wb.worksheets[1:]:
        hdr = [c.value for c in ws[1]]
        ix = {h: i for i, h in enumerate(hdr)}
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            nid = row[0]; sheet = ws.title; letter = sheet[0]
            dec = row[ix['قرار المالك']] or ('موافق' if letter in assume else None)
            if dec not in ('موافق', 'مرفوض', 'موافق مع تصحيح', 'مؤجل'):
                continue
            p = props[nid]; x = p['reading'] or {}
            pid = 'hk37p-' + hid('p', nid)
            correction = row[ix['ملاحظته']] if dec == 'موافق مع تصحيح' else None
            stmts.append(f"""INSERT INTO boe.review_proposal (id, note_id, piece_no, category, effect, instrument, instrument_date_hijri, new_text, evidence, confidence, reason, image_url, review_run, created_at)
SELECT {q(pid)}, {q(nid)}, 1, 3, {q(x.get('effect'))}, {q(x.get('instrument_seen'))}, {q(row[ix['تاريخها']])}, {q(p.get('composed') or x.get('new_text'))}, {q(x.get('lead_in'))}, {q(x.get('confidence'))}, {q(sheet + ' — ' + (p.get('action') or ''))}, {q(' '.join(x.get('pages') or []))}, {q(RUN)}, now()
WHERE NOT EXISTS (SELECT 1 FROM boe.review_proposal WHERE id = {q(pid)})""")
            report['proposal'] += 1
            did = 'hk37d-' + hid('d', nid, dec)
            stmts.append(f"""INSERT INTO boe.owner_decision (id, proposal_id, decision, corrected_text, owner_note, decided_by, decided_at)
SELECT {q(did)}, {q(pid)}, {q(dec)}, {q(correction)}, {q(row[ix['ملاحظته']])}, 'owner', now()
WHERE NOT EXISTS (SELECT 1 FROM boe.owner_decision WHERE id = {q(did)})""")
            report['decision'] += 1
            if dec not in ('موافق', 'موافق مع تصحيح') or letter not in 'أبجد':
                continue
            aid = p.get('aid')
            if not aid:
                report['skipped_no_article'].append(nid); continue
            inst = x.get('instrument_seen') or row[ix['الأداة']]
            quote = (x.get('lead_in') or '')[:1500]
            if letter == 'ب':
                body = correction or p.get('composed')
                vf = greg(inst) or greg(row[ix['تاريخها']])
                if not body or not vf:
                    report['skipped_no_date'].append(nid); continue
                uid = 'hk37u-' + hid('u', aid, nid)
                stmts.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {q(uid)}, {q(aid)}, {q(body)}, {q(vf)}::timestamptz, {q(inst)}, {q(p.get('law_url'))}, {q(quote)}, now()
WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {q(uid)})
  AND EXISTS (SELECT 1 FROM legal_articles WHERE id = {q(aid)})""")
                report['unit_version'] += 1
            status = 'ملغاة' if letter == 'ج' else 'ساري'
            vid = 'vf37-' + hid('v', aid, nid, status)
            stmts.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at)
SELECT {q(vid)}, 'unit', {q(aid)}, {q(status)}, {q(inst)}, {q(p.get('law_url'))}, {q(quote)}, 'owner_decision', {q(BY)}, now()
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {q(vid)})
  AND EXISTS (SELECT 1 FROM legal_articles WHERE id = {q(aid)})""")
            report['verification'] += 1
    fp = hashlib.md5('\n'.join(stmts).encode()).hexdigest()
    out = D / ('statements.assumed.json' if assume else 'statements.json')
    out.write_text(json.dumps({'by': BY, 'md5': fp, 'count': len(stmts), 'report': report, 'statements': stmts}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({'file': out.name, 'md5': fp, 'statements': len(stmts), **{k: (v if not isinstance(v, list) else len(v)) for k, v in report.items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
