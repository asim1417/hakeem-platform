"""يقرأ قرارات المراجعة من ملف Excel ويضيفها صفوفًا جديدة في uqn_fix.amendment_review (لا تعديل ولا حذف).
الاستخدام: DATABASE_URL=... python scripts/import_review.py مراجعة_التعديلات_والإحلالات.xlsx [--dry-run]"""
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
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); rows = []; errors = []
for sh in ('مراجعة سريعة', 'مراجعة دقيقة'):
    for r in wb[sh].iter_rows(min_row=2, values_only=True):
        dec, rev, note, op_id = r[0], r[1], r[2], r[3]
        if not dec: continue
        if dec not in MAP: errors.append((op_id, f'قرار غير معروف: {dec}')); continue
        if not rev: errors.append((op_id, 'بلا اسم مراجع')); continue
        fix = parse_fix(note) if MAP[dec] == 'approved_with_edit' else None
        if MAP[dec] == 'approved_with_edit' and not fix: errors.append((op_id, 'تصحيح بلا حقول بصيغة حقل=قيمة')); continue
        rows.append((op_id, MAP[dec], json.dumps(fix, ensure_ascii=False) if fix else None, rev, note))
print(f'قرارات صالحة: {len(rows)} | أخطاء: {len(errors)}')
for e in errors[:20]: print('  خطأ:', e)
if '--dry-run' in sys.argv or errors: sys.exit(1 if errors else 0)
import psycopg
with psycopg.connect(os.environ['DATABASE_URL']) as con, con.cursor() as cur:
    cur.executemany("INSERT INTO uqn_fix.amendment_review(op_id,decision,corrected,reviewer,note) VALUES (%s,%s,%s::jsonb,%s,%s)", rows)
    con.commit()
print('أُضيفت القرارات (إضافة فقط)')
