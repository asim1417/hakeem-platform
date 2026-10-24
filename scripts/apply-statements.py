#!/usr/bin/env python3
"""ينفّذ ملف statements.json كما هو حرفيًا في معاملة واحدة (بلا إعادة كتابة يدوية للنص القانوني).

  python3 scripts/apply-statements.py --file <statements.json> --mode preview|apply --expect-md5 <md5>

- يتحقق أن md5 العبارات المجموعة بسطر جديد يساوي md5 المخزّن في الملف وما مرّره المالك/الوكيل.
- يرفض أي عبارة لا تبدأ بـ INSERT (إضافة فقط).
- حارس أعداد: legal_articles وlegal_systems لا يتغيران.
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
            for s in st:
                cur.execute(s)
                rows += max(cur.rowcount, 0)
            after = counts()
            for t in ('public.legal_articles', 'public.legal_systems'):
                if before[t] != after[t]:
                    raise RuntimeError(f'تغيّر عدد {t} — أُلغيت')
            if a.allow_guarded_update:
                cur.execute("SELECT count(*) FROM legal_text_provenance WHERE source_id = %s", (d.get('by'),))
                prov = cur.fetchone()[0]
            else:
                prov = None
            print(json.dumps({'mode': a.mode, 'provenance_rows_for_batch': prov, 'md5': got, 'statements': len(st), 'rows_inserted': rows, 'before': before, 'after': after,
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
