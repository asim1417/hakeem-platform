"""اختبار: import_review يطبّق تصحيحات السريان ويمنع اعتماد ما تعذّر سريانه بلا تاريخ. (لا يتصل بقاعدة)
python tests/test_import_effective.py"""
import json, os, sys, tempfile, openpyxl
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
EFF = {e['op_id']: e for e in (json.loads(l) for l in open(os.path.join(ROOT, 'data', 'effective_corrections.jsonl'), encoding='utf-8'))}
changed = next(k for k, e in EFF.items() if e['changed'])
failed = [k for k, e in EFF.items() if e['requires_effective_in_note']][:2]
silent = next(k for k, e in EFF.items() if e['basis'] == 'silent_art71')
handled = next(k for k, e in EFF.items() if e.get('handled_by'))
wb = openpyxl.load_workbook(os.path.join(ROOT, 'مراجعة_التعديلات_والإحلالات.xlsx'))
plan = {changed: ('موافق', None), failed[0]: ('موافق', None), failed[1]: ('موافق مع تصحيح', 'يسري من=1448-01-01'), silent: ('مرفوض', None), handled: ('موافق', None)}
for sh in ('مراجعة سريعة', 'مراجعة دقيقة'):
    for r in range(2, wb[sh].max_row + 1):
        op = wb[sh].cell(r, 4).value
        if op in plan:
            wb[sh].cell(r, 1, plan[op][0]); wb[sh].cell(r, 2, 'اختبار'); wb[sh].cell(r, 3, plan[op][1])
tmp = os.path.join(tempfile.mkdtemp(), 't.xlsx'); wb.save(tmp)
g = {'__name__': '__main__', '__file__': os.path.join(ROOT, 'scripts', 'import_review.py')}
sys.argv = ['import_review.py', tmp, '--dry-run']
try: exec(open(g['__file__'], encoding='utf-8').read(), g)
except SystemExit: pass
rows = {r[0]: r for r in g['rows']}; errs = {e[0] for e in g['errors']}
assert rows[changed][1] == 'approved_with_edit' and json.loads(rows[changed][2])['effective_from_hijri'] == EFF[changed]['effective_from_hijri'], rows[changed]
assert failed[0] in errs and failed[0] not in rows
assert json.loads(rows[failed[1]][2])['effective_from_hijri'] == '1448-01-01'
assert rows[silent][1] == 'rejected' and 'سند السريان' in rows[silent][4]
assert handled in errs and handled not in rows
# غياب ملف التصحيحات يوقف الاستيراد بدل أن يعمل بصمت
lone = os.path.join(tempfile.mkdtemp(), 'scripts'); os.makedirs(lone)
g2 = {'__name__': '__main__', '__file__': os.path.join(lone, 'import_review.py')}
try: exec(open(g['__file__'], encoding='utf-8').read(), g2); stopped = None
except SystemExit as e: stopped = e.code
assert isinstance(stopped, str) and 'غير موجود' in stopped and 'rows' not in g2, stopped
print('6/6 ناجحة')
