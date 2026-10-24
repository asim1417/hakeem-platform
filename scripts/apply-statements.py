#!/usr/bin/env python3
"""ينفّذ ملف statements.json كما هو حرفيًا في معاملة واحدة (بلا إعادة كتابة يدوية للنص القانوني).

  python3 scripts/apply-statements.py --file <statements.json> --mode preview|apply --expect-md5 <md5>

- يتحقق أن md5 العبارات المجموعة بسطر جديد يساوي md5 المخزّن في الملف وما مرّره المالك/الوكيل.
- يرفض أي عبارة لا تبدأ بـ INSERT (إضافة فقط).
- حارس أعداد: legal_articles وlegal_systems لا يتغيران إلا بالفرق المعلن في expect_delta.
- preview يتراجع ويطبع العدّ، apply يثبّت. DATABASE_URL من البيئة ولا يُطبع.
"""
import argparse, hashlib, json, os, sys

import psycopg2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', required=True)
    ap.add_argument('--mode', choices=['preview', 'apply'], required=True)
    ap.add_argument('--expect-md5', required=True)
    ap.add_argument('--allow-guarded-update', action='store_true',
                    help='يسمح بـ UPDATE legal_articles SET content المحروس ببصمة النص الحالي (md5(content) = ...) فقط')
    a = ap.parse_args()
    d = json.load(open(a.file, encoding='utf-8'))
    st = d['statements']
    got = hashlib.md5('\n'.join(st).encode()).hexdigest()
    if got != d['md5'] or got != a.expect_md5:
        print(f'::error::بصمة العبارات {got} لا تطابق الملف {d["md5"]} أو المتوقع {a.expect_md5}')
        return 2
    import re
    guarded = re.compile(r'^\s*UPDATE legal_articles SET content = .*\s+WHERE id = \$hk\$[^$]+\$hk\$ AND md5\(content\) = \$hk\$[0-9a-f]{32}\$hk\$\s*$', re.S)
    def ok(s):
        if s.lstrip().upper().startswith('INSERT'):
            return True
        # حارس قراءة فقط: SELECT CASE WHEN ... THEN 'ok' ELSE (1/0) — يُفشل المعاملة كلها إن لم يتحقق الشرط
        if re.match(r'^\s*SELECT CASE WHEN', s) and not re.search(r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b', s, re.I):
            return True
        # تاريخ نفاذ النظام: تعبئة حقل فارغ فقط (لا يستبدل قيمة قائمة)
        if a.allow_guarded_update and re.match(r"^\s*UPDATE legal_systems SET preamble_effective_from = \$hk\$\d{4}-\d{2}-\d{2}\$hk\$::timestamptz WHERE id = \$hk\$[^$]+\$hk\$ AND preamble_effective_from IS NULL\s*$", s):
            return True
        return a.allow_guarded_update and bool(guarded.match(s))
    bad = [i for i, s in enumerate(st) if not ok(s)]
    if bad:
        print(f'::error::عبارات ليست إضافة: {bad[:10]}')
        return 2
    url = os.environ.get('DATABASE_URL')
    if not url:
        print('::error::DATABASE_URL غير مضبوط')
        return 2
    con = psycopg2.connect(url)
    con.autocommit = False
    tables = ['public.legal_articles', 'public.legal_systems', 'public.unit_version', 'public.verification', 'boe.review_proposal', 'boe.owner_decision']
    try:
        with con.cursor() as cur:
            def counts():
                out = {}
                for t in tables:
                    cur.execute(f'SELECT count(*) FROM {t}')
                    out[t] = cur.fetchone()[0]
                return out
            before = counts()
            rows = 0
            per = []
            for i, s in enumerate(st):
                try:
                    cur.execute(s)
                except Exception as e:
                    raise RuntimeError(f'العبارة {i} فشلت ({e}); صفوف ما قبلها: {per}') from e
                per.append(max(cur.rowcount, 0))
                rows += per[-1]
            after = counts()
            # الأصل: لا يتغير عدد المواد والأنظمة. ملف يضيف إصدارًا جديدًا يعلن الفرق المتوقع بدقة في expect_delta.
            exp = d.get('expect_delta', {})
            for t in ('public.legal_articles', 'public.legal_systems'):
                if after[t] - before[t] != exp.get(t, 0):
                    raise RuntimeError(f'تغيّر عدد {t} بمقدار {after[t] - before[t]} والمتوقع {exp.get(t, 0)} — أُلغيت')
            if a.allow_guarded_update:
                cur.execute("SELECT count(*) FROM legal_text_provenance WHERE source_id = %s", (d.get('by'),))
                prov = cur.fetchone()[0]
            else:
                prov = None
            print(json.dumps({'mode': a.mode, 'provenance_rows_for_batch': prov, 'md5': got, 'statements': len(st), 'rows_inserted': rows, 'rows_per_statement': per, 'before': before, 'after': after,
                              'delta': {t: after[t] - before[t] for t in tables}}, ensure_ascii=False, indent=1))
            if a.mode == 'apply':
                con.commit(); print('COMMITTED')
            else:
                con.rollback(); print('ROLLED BACK (preview)')
    except Exception as e:
        con.rollback()
        print(f'::error::{e}')
        return 1
    finally:
        con.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
