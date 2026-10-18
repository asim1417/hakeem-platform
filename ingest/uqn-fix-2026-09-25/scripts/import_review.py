"""يقرأ قرارات المراجعة من ملف Excel ويضيفها صفوفًا جديدة في uqn_fix.amendment_review (لا تعديل ولا حذف).
الاستخدام: DATABASE_URL=... python scripts/import_review.py مراجعة_التعديلات_والإحلالات.xlsx [--dry-run] [--no-effective-corrections]

تصحيحات السريان (2026-10-18): يُقرأ data/effective_corrections.jsonl تلقائيًّا إن وُجد.
- «موافق» على عملية أُعيد حساب سريانها يتحول إلى approved_with_edit بالتاريخ المعاد، ويُلحق السند بالملاحظة.
- العمليات التي تعذّر سريانها أو اشترط لا تُقبل «موافق» إلا ومعها «يسري من=…» في الملاحظة.
- قرار المالك «موافق مع تصحيح» بحقل «يسري من» يعلو التصحيح الآلي (مع تنبيه عند الاختلاف)."""
import sys, os, re, json, datetime, warnings
import openpyxl
warnings.filterwarnings('ignore')
MAP = {'موافق': 'approved', 'مرفوض': 'rejected', 'موافق مع تصحيح': 'approved_with_edit'}
FIELDS = {'المادة': 'article_number', 'الفقرة': 'paragraph_label', 'يسري من': 'effective_from_hijri', 'النص': 'new_text',
          'العملية': 'op_type', 'العبارة القديمة': 'old_phrase', 'العبارة الجديدة': 'new_phrase', 'النظام': 'target_law_title'}
def parse_fix(note):
    out = {}
    for part in re.split(r'[؛;]\s*', note or ''):
        if '=' in part:
            k, v = [x.strip() for x in part.split('=', 1)]
            if k in FIELDS: out[FIELDS[k]] = int(v) if FIELDS[k] == 'article_number' else v
    if 'effective_from_hijri' in out:
        from hijri_converter import Hijri
        y, m, d = map(int, out['effective_from_hijri'].split('-')); out['effective_from_gregorian'] = Hijri(y, m, d).to_gregorian().isoformat()
    return out
EFF = {}
_eff_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'effective_corrections.jsonl')
if '--no-effective-corrections' not in sys.argv and os.path.exists(_eff_path):
    EFF = {e['op_id']: e for e in (json.loads(l) for l in open(_eff_path, encoding='utf-8') if l.strip())}
warns = []
def apply_eff(op_id, dec, fix, note):
    e = EFF.get(op_id)
    if not e: return dec, fix, note, None
    sanad = f"سند السريان: {e['sanad']}"
    note2 = f"{note} | {sanad}" if note else sanad
    if e.get('handled_by') and dec in ('approved', 'approved_with_edit'):
        return dec, fix, note2, f"عولجت في الإنتاج بمهمة {e['handled_by']}: اعتمادها يكرر السجل — سجّلها «مرفوض» بملاحظة"
    if e['requires_effective_in_note'] and not (fix or {}).get('effective_from_hijri'):
        return dec, fix, note2, 'السريان تعذّر/مشروط: أضف «يسري من=…» بسنده في الملاحظة مع «موافق مع تصحيح»'
    if e['changed'] and dec in ('approved', 'approved_with_edit'):
        fix = dict(fix or {})
        if 'effective_from_hijri' in fix:
            if fix['effective_from_hijri'] != e['effective_from_hijri']:
                warns.append((op_id, f"تاريخ المالك {fix['effective_from_hijri']} يخالف المعاد {e['effective_from_hijri']} — اعتُمد تاريخ المالك"))
        else:
            fix['effective_from_hijri'] = e['effective_from_hijri']; fix['effective_from_gregorian'] = e['effective_from_gregorian']
        dec = 'approved_with_edit'
    return dec, fix, note2, None
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); rows = []; errors = []
for sh in ('مراجعة سريعة', 'مراجعة دقيقة'):
    for r in wb[sh].iter_rows(min_row=2, values_only=True):
        dec, rev, note, op_id = r[0], r[1], r[2], r[3]
        if not dec: continue
        if dec not in MAP: errors.append((op_id, f'قرار غير معروف: {dec}')); continue
        if not rev: errors.append((op_id, 'بلا اسم مراجع')); continue
        fix = parse_fix(note) if MAP[dec] == 'approved_with_edit' else None
        if MAP[dec] == 'approved_with_edit' and not fix: errors.append((op_id, 'تصحيح بلا حقول بصيغة حقل=قيمة')); continue
        d2, fix, note, err = apply_eff(op_id, MAP[dec], fix, note)
        if err and d2 != 'rejected': errors.append((op_id, err)); continue
        rows.append((op_id, d2, json.dumps(fix, ensure_ascii=False) if fix else None, rev, note))
print(f'قرارات صالحة: {len(rows)} | أخطاء: {len(errors)}')
for e in errors[:20]: print('  خطأ:', e)
for w in warns[:20]: print('  تنبيه:', w)
if EFF: print(f"تصحيحات السريان: محمّلة ({len(EFF)}) — حُوّل {sum(1 for r in rows if r[1]=='approved_with_edit' and EFF.get(r[0],{}).get('changed'))} قرارًا إلى تصحيح بالتاريخ المعاد")
if '--dry-run' in sys.argv or errors: sys.exit(1 if errors else 0)
import psycopg
with psycopg.connect(os.environ['DATABASE_URL']) as con, con.cursor() as cur:
    cur.executemany("INSERT INTO uqn_fix.amendment_review(op_id,decision,corrected,reviewer,note) VALUES (%s,%s,%s::jsonb,%s,%s)", rows)
    con.commit()
print('أُضيفت القرارات (إضافة فقط)')
