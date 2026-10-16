"""يبني صفوف الحقن المرشحة من الأزواج ثابتة الهوية فقط (الدرجة ١)، ولا يكتب على أي قاعدة.
المخرج ملفات JSONL تُعرض أرقامها وعيّنتها على المالك، ثم تُحقن بعد كلمته.

  python3 scripts/build_injection.py <scratch_dir> <out_dir>

المدخلات في scratch_dir (لقطات قراءة من الإنتاج):
  identity_match.json، diff_classes.json، prod_article_ids.json، prod_verification.json

القواعد:
- حالة النظام: لنظام مطابق بالدرجة ١ وليس له صف تحقق للعمل في حكيم. «لاغي» ← «ملغى»، «ساري» ← «ساري».
  ما يخالف صف تحقق قائمًا في حكيم لا يُحقن، ويُحال للمالك.
- نسخة المادة: تُبنى فقط لمادة كل ملاحظاتها محسومة (محسوم من الملاحظة أو مؤكد)، وكل آثارها
  «تعديل مادة كاملة» أو «إلغاء مادة»، وأساسها في حكيم يطابق الهيئة، وتواريخ أدواتها مختلفة.
  ما سوى ذلك يؤجَّل بسببه (تركيب فقرة أو عبارة يحتاج المرحلة ٤).
- valid_from = تاريخ أداة التعديل بأم القرى، وأساسه «issue» (تاريخ الإصدار لا النشر).
"""
import collections
import hashlib
import json
import pathlib
import re
import sys

import psycopg
from hijri_converter import Hijri

FULL = {'amend_article', 'تعديل مادة'}
REPEAL = {'repeal', 'إلغاء مادة'}
NO_TEXT = {'إجراء إداري لا يمس النص', 'تفسير'}
RESOLVED = {'محسوم من الملاحظة', 'مؤكد'}
RUN = 'boe-2026-09-28'

# مرشّحات أضافها التحقق المستقل (16/10/2026)
PARTIAL_NOTE = re.compile(r'صدر (هذه )?المادة|عجز (هذه )?المادة|فقر|البند|بند|عبارة|إحلال|الشطر')
LEAK = re.compile(r'وذلك بموجب|بموجب (المرسوم|الأمر|قرار)|ويعمل بهذا|يُعمل بهذا|مدرج في صيغة|وقد أعد|عُدِّلت|عدلت هذه')
LATER_FORCE = re.compile(r'يُ?عمل ب|نفاذ|اعتبارًا من|اعتبارا من|بعد مضي|بعد (مرور|انقضاء)|من تاريخ (نشره|العمل)')
INSTR_MENTION = re.compile(r'(?:المرسوم الملكي|الأمر الملكي|قرار مجلس الوزراء)\s+رقم')
MANUAL = {'fb87c2d0'}


def clean_body(t):
    t = (t or '').strip().strip('"«»“” \n')
    t = re.sub(r'^\s*المادة\s+[^\n:]{1,60}:\s*', '', t).strip()
    return t.strip('"«»“” \n')


def version_problem(note, body):
    if PARTIAL_NOTE.search(note or ''):
        return 'الملاحظة تعدّل جزءًا من المادة لا كلها'
    if len(body) < 40 or '...' in body or '…' in body:
        return 'النص الجديد جزء أو مقتطع'
    if LEAK.search(body):
        return 'نص الملاحظة متسرب إلى نص المادة'
    if LATER_FORCE.search(note or ''):
        return 'تاريخ النفاذ غير تاريخ الإصدار (ينتظر تحديد تاريخ النفاذ)'
    if len(INSTR_MENTION.findall(note or '')) > 1:
        return 'النص حصيلة أكثر من أداة'
    return None


def sid(*parts):
    return 'boe26-' + hashlib.sha256('|'.join(map(str, parts)).encode()).hexdigest()[:24]


def fmt_instr(ins):
    if not ins:
        return None
    kind, no, date = ins
    y, m, d = (date or '').split('-') if date else ('', '', '')
    k = 'مرسوم ملكي' if kind == 'royal' else 'قرار مجلس الوزراء'
    return f"{k} رقم {no}" + (f" وتاريخ {int(y)}/{int(m)}/{int(d)}هـ" if date else '')


def greg(h):
    nums = re.findall(r'\d+', h or '')
    if len(nums) < 3:
        return None
    a, b, c = map(int, nums[:3])
    d, m, y = (c, b, a) if a > 1000 else (a, b, c)
    try:
        return Hijri(y, m, d).to_gregorian().isoformat()
    except (ValueError, OverflowError):
        return None


def main():
    src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    im = [x for x in json.load(open(src / 'identity_match.json')) if x['grade'] == 1]
    bad = {(r['system_id'], r['article']) for r in json.load(open(src / 'diff_classes.json'))
           if r['class'] in ('مختلف جوهريًّا', 'لفظي')}
    art = {(a['s'], int(a['n'])): a for a in json.load(open(src / 'prod_article_ids.json'))}
    ver = collections.defaultdict(set)
    for v in json.load(open(src / 'prod_verification.json')):
        ver[(v['t'], v['o'])].add(v['v'])
    con = psycopg.connect('postgresql://hk:hk@127.0.0.1/hakeem')

    work_rows, work_conflicts = [], []
    for m in im:
        target = {'لاغي': 'ملغى', 'ساري': 'ساري'}.get(m['boe_status'])
        existing = ver.get(('work', m['system_id']))
        if existing:
            if target and target not in existing:
                work_conflicts.append({'system_id': m['system_id'], 'law': m['boe_name'],
                                       'hakeem': sorted(existing), 'boe': m['boe_status']})
            continue
        if not target:
            continue
        ins = m['boe_instruments'][0] if m['boe_instruments'] else None
        work_rows.append({
            'id': sid('work', m['system_id'], target, RUN), 'object_type': 'work', 'object_id': m['system_id'],
            'verified_status': target,
            'evidence_instrument': fmt_instr(ins),
            'evidence_url': m['boe_url'],
            'evidence_quote': f"حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: {m['boe_status']} (رُصدت 28/9/2026)",
            'method': 'rule', 'verified_by': RUN, '_law': m['boe_name']})

    unit_versions, unit_status, deferred = [], [], collections.Counter()
    deferred_rows = []
    for m in im:
        rows = con.execute("""
            select u.article_number, a.note_id, a.confidence, coalesce(a.proposed_effect, a.parser_effect),
                   coalesce(a.corrected_text, a.new_text), a.instrument_kind, a.instrument_no, a.instrument_date_hijri,
                   a.source_url, a.note_text
            from boe.v_amendment a join boe.law l on l.guid = a.law_guid
            join boe.unit u on u.law_id = l.id and u.seq = a.unit_seq
            where a.law_guid = %s and l.parsed_at = (select max(parsed_at) from boe.law where guid = a.law_guid)
              and u.article_number is not null and not u.is_bis""", (m['law_guid'],)).fetchall()
        by_art = collections.defaultdict(list)
        for r in rows:
            by_art[r[0]].append(r)
        for n, notes in by_art.items():
            a = art.get((m['system_id'], n))
            reason = None
            notes = [r for r in notes if r[3] not in NO_TEXT]
            if not notes:
                continue
            if not a:
                reason = 'المادة غير موجودة في حكيم'
            elif (m['system_id'], n) in bad:
                reason = 'نص حكيم يخالف نص الهيئة الأصلي'
            elif any(r[2] not in RESOLVED for r in notes):
                reason = 'ملاحظة تنتظر قرار المالك أو مرجّحة'
            elif any(r[3] not in FULL | REPEAL for r in notes):
                reason = 'تعديل فقرة أو عبارة يحتاج تركيب النص (المرحلة ٤)'
            elif any(r[3] in FULL and not r[4] for r in notes):
                reason = 'تعديل بلا نص جديد'
            else:
                dated = [(greg(r[7]), r) for r in notes]
                if any(d is None for d, _ in dated):
                    reason = 'تاريخ أداة غير مقروء'
                elif len({d for d, _ in dated}) != len(dated):
                    reason = 'تعديلان بتاريخ واحد'
                else:
                    dated.sort(key=lambda t: t[0])
                    if any(r[3] in REPEAL for _, r in dated[:-1]):
                        reason = 'إلغاء يتبعه تعديل لاحق'
                    for _, r in dated:
                        if reason:
                            break
                        if r[3] in FULL:
                            reason = version_problem(r[9], clean_body(r[4]))
                        elif re.search(r'فقر|بند', r[9] or ''):
                            reason = 'الإلغاء لفقرة لا للمادة'
                    if not reason and any(sid('uv', a['id'], d, r[1])[6:14] in MANUAL for d, r in dated):
                        reason = 'مراجعة يدوية طلبها التحقق المستقل'
            if reason:
                deferred[reason] += len(notes)
                deferred_rows.append({'system_id': m['system_id'], 'law': m['boe_name'], 'article': n,
                                      'notes': len(notes), 'reason': reason})
                continue
            for d, r in dated:
                instr = f"{'مرسوم ملكي' if r[5] == 'royal_decree' else 'قرار مجلس الوزراء' if r[5] == 'cabinet_decision' else (r[5] or '')} رقم {r[6] or '?'} وتاريخ {r[7]}هـ".strip()
                if r[3] in FULL:
                    unit_versions.append({
                        'id': sid('uv', a['id'], d, r[1]), 'unit_id': a['id'], 'body': clean_body(r[4]), 'valid_from': d,
                        'valid_from_basis': 'issue', 'evidence_instrument': instr, 'evidence_url': r[8],
                        'evidence_quote': (r[9] or '')[:500], '_law': m['boe_name'], '_article': n, '_note': r[1]})
                else:
                    unit_status.append({
                        'id': sid('unit', a['id'], 'ملغاة', r[1]), 'object_type': 'unit', 'object_id': a['id'],
                        'verified_status': 'ملغاة', 'evidence_instrument': instr, 'evidence_url': r[8],
                        'evidence_quote': (r[9] or '')[:500], 'method': 'rule', 'verified_by': RUN,
                        '_law': m['boe_name'], '_article': n, '_already_repealed_in_hakeem': a['st'] == 'ملغاة'})

    for name, data in [('work_status', work_rows), ('unit_versions', unit_versions), ('unit_status', unit_status),
                       ('work_conflicts', work_conflicts), ('deferred', deferred_rows)]:
        with open(out / f'{name}.jsonl', 'w', encoding='utf-8') as f:
            for row in data:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')
    summary = {
        'حالة النظام': dict(collections.Counter(r['verified_status'] for r in work_rows)),
        'تعارض حالة مع حكيم': len(work_conflicts),
        'نسخ مواد': len(unit_versions), 'مواد بنسخ': len({r['unit_id'] for r in unit_versions}),
        'إلغاء مواد': len(unit_status),
        'إلغاء مواد ملغاة أصلًا في حكيم': sum(1 for r in unit_status if r['_already_repealed_in_hakeem']),
        'مؤجل (ملاحظات)': dict(deferred), 'مؤجل (مواد)': len(deferred_rows),
    }
    json.dump(summary, open(out / 'summary.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
