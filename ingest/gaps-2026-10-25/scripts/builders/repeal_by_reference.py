#!/usr/bin/env python3
"""مولّد دفعة U4b: تسجيل «ملغاة» لمواد ألغتها مادة في نظام لاحق موجودة في حكيم نفسه (إلغاء بالإحالة).

خطوتان، والكتابة الوحيدة في النهاية عبر apply-statements.yml بإذن المالك:
  1) plan  : يقرأ ledger.jsonl (بنود U4b route=build) ويكتب config.json وpins.sql (قراءة فقط).
             شغّل pins.sql بمعاملة READ ONLY واحفظ ناتجه pins.json (عمود pins).
  2) build : يقرأ config.json وpins.json ويكتب statements.json + sample.md (عيّنة المالك).

الدليل في كل صف verification حرفي من القاعدة لا من الذاكرة: نص المادة المُلغية، ونص مادة النفاذ في النظام نفسه،
وأداة إصداره من ديباجته، ورابط صفحته في الهيئة؛ ويُضاف أساس المدى (أرقام منصوصة أو عناوين الأبواب) وما يظهر في صفحة الهيئة من شطب.
"""
import argparse, collections, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import guard, h, latest_unit_status, latest_work_status, lit, write_batch  # noqa: E402

REPEALED = "('ملغاة','ملغى','مستبدل')"
PART_WORD = {1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن', 9: 'التاسع',
             10: 'العاشر', 11: 'الحادي عشر', 12: 'الثاني عشر'}


def plan(a):
    groups = collections.OrderedDict()
    for line in open(a.ledger, encoding='utf-8'):
        it = json.loads(line)
        if it['gap'] != 'U4b' or it['route'] != 'build' or it['status'] != 'open':
            continue
        k = (it['repealer_article_id'], it['target_system_id'])
        g = groups.setdefault(k, {'key': f'G{len(groups) + 1}', 'repealer_system_id': it['repealer_system_id'],
                                  'repealer_article_id': it['repealer_article_id'], 'repealer_law': it['repealer_law'],
                                  'repealer_article': it['repealer_article'], 'target_system_id': it['target_system_id'],
                                  'target_law': it['target_law'], 'target_law_as_cited': it['target_law_as_cited'],
                                  'kind': it['target_kind'], 'part': it.get('target_part'), 'basis': it['basis'], 'numbers': [], 'article_ids': []})
        g['numbers'].append(it['article_number'])
        g['article_ids'].append(it['article_id'])
    cfg = {'batch': a.batch, 'by': a.by, 'groups': list(groups.values())}
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'config.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf-8')
    parts = []
    for g in cfg['groups']:
        ids = ','.join(lit(i) for i in g['article_ids'])
        parts.append(f"""SELECT {lit(g['key'])} k,
 (SELECT md5(content) FROM legal_articles WHERE id={lit(g['repealer_article_id'])}) rep_md5,
 (SELECT x.id FROM legal_articles x WHERE x."legalSystemId"={lit(g['repealer_system_id'])} AND x."articleBis"=0 AND x.content ~ '^\\s*(يعمل|يُعمل|ينشر)[^.]*' AND x."articleNumber" >= (SELECT max("articleNumber")-3 FROM legal_articles WHERE "legalSystemId"={lit(g['repealer_system_id'])} AND "articleBis"=0) ORDER BY x."articleNumber" DESC LIMIT 1) eff_id,
 (SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x."articleNumber", x."articleBis")) FROM legal_articles x WHERE x.id IN ({ids})) set_md5,
 (SELECT count(*) FROM legal_articles x WHERE x.id IN ({ids})) n,
 (SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id={lit(g['target_system_id'])} JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id
    WHERE u.css_class LIKE '%canceled%' AND u.article_number IN ({','.join(str(n) for n in g['numbers'])})) boe_struck,
 (SELECT l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id={lit(g['repealer_system_id'])} ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_url""")
    sql = ("-- قراءة فقط. شغّله داخل BEGIN; SET TRANSACTION READ ONLY; … ROLLBACK;\n"
           "WITH p AS (\n" + "\nUNION ALL\n".join(parts) + "\n)\n"
           "SELECT 'PINS' tag, json_agg(json_build_object('k',k,'rep_md5',rep_md5,'eff_id',eff_id,'eff_md5',(SELECT md5(content) FROM legal_articles WHERE id=eff_id),"
           "'set_md5',set_md5,'n',n,'boe_struck',boe_struck,'rep_url',rep_url)) pins FROM p;\n")
    (out / 'pins.sql').write_text(sql, encoding='utf-8')
    print(f"{len(cfg['groups'])} مجموعة، {sum(len(g['numbers']) for g in cfg['groups'])} مادة → {out}/config.json و pins.sql")


def build(a):
    out = pathlib.Path(a.out)
    cfg = json.loads((out / 'config.json').read_text(encoding='utf-8'))
    pins = {p['k']: p for p in json.loads((out / 'pins.json').read_text(encoding='utf-8'))}
    BY = cfg['by']
    st, report, sample = [], [], []
    conds = []
    for g in cfg['groups']:
        p = pins[g['key']]
        assert p['n'] == len(g['article_ids']), (g['key'], p['n'], len(g['article_ids']))
        assert p['eff_id'] and p['rep_md5'] and p['set_md5'] and p['rep_url'], g['key']
        ids = ','.join(lit(i) for i in g['article_ids'])
        conds += [
            f"(SELECT count(*) FROM legal_articles WHERE id={lit(g['repealer_article_id'])} AND \"legalSystemId\"={lit(g['repealer_system_id'])} AND md5(content)={lit(p['rep_md5'])})=1",
            f"(SELECT count(*) FROM legal_articles WHERE id={lit(p['eff_id'])} AND \"legalSystemId\"={lit(g['repealer_system_id'])} AND md5(content)={lit(p['eff_md5'])})=1",
            f"{latest_work_status(lit(g['repealer_system_id']))}='ساري'",
            f"{latest_work_status(lit(g['target_system_id']))}='ساري'",
            f"(SELECT count(*) FROM legal_articles x WHERE x.id IN ({ids}) AND x.\"legalSystemId\"={lit(g['target_system_id'])} AND x.\"articleBis\"<100)={p['n']}",
            f"(SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x.\"articleNumber\", x.\"articleBis\")) FROM legal_articles x WHERE x.id IN ({ids}))={lit(p['set_md5'])}",
            f"(SELECT count(*) FROM legal_articles x WHERE x.id IN ({ids}) AND coalesce({latest_unit_status('x.id')},'') IN {REPEALED})=0",
            f"(SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id={lit(g['target_system_id'])} JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id WHERE u.css_class LIKE '%canceled%' AND u.article_number IN ({','.join(str(n) for n in g['numbers'])}))={p['boe_struck']}",
        ]
        if g['kind'] == 'part':  # حدود الباب: أول مادة تحمل عنوانه، والمادة بعد آخرها تحمل عنوان الباب التالي
            lo, hi = min(g['numbers']), max(g['numbers'])
            word = PART_WORD[g['part']]
            conds.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(g['target_system_id'])} AND \"articleNumber\"={lo} AND \"articleBis\"=0 AND chapter LIKE {lit('الباب%' + word + '%')})=1")
            conds.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(g['target_system_id'])} AND \"articleNumber\"={hi + 1} AND \"articleBis\"=0 AND chapter LIKE 'الباب%')=1")
            conds.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={lit(g['target_system_id'])} AND \"articleNumber\" BETWEEN {lo + 1} AND {hi} AND \"articleBis\"<100 AND chapter LIKE 'الباب%')=0")
        lo, hi = min(g['numbers']), max(g['numbers'])
        struck = f"؛ صفحة الهيئة تشطب {p['boe_struck']} من {p['n']}" if p['boe_struck'] else '؛ صفحة الهيئة لا تشطبها'
        basis = g['basis'] + struck
        quote = (f"'المادة ('||r.\"articleNumber\"||') من '||r.\"lawName\"||': «'||btrim(r.content)||'» — '||"
                 f"'مادة النفاذ ('||e.\"articleNumber\"||'): «'||btrim(e.content)||'» — '||{lit(basis)}")
        st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg1-'||left(encode(sha256(convert_to({lit(BY)}||'|'||x.id||'|ملغاة','UTF8')),'hex'),24), 'unit', x.id, 'ملغاة',
  coalesce(nullif(btrim(s.preamble_royal_decree),''), s.name), {lit(p['rep_url'])}, {quote}, 'rule', {lit(BY)}, NULL
FROM legal_articles x
JOIN legal_articles r ON r.id={lit(g['repealer_article_id'])}
JOIN legal_articles e ON e.id={lit(p['eff_id'])}
JOIN legal_systems s ON s.id=r."legalSystemId"
WHERE x.id IN ({ids}) ORDER BY x."articleNumber", x."articleBis\"""")
        report.append({'group': g['key'], 'repealer': f"{g['repealer_law']} م{g['repealer_article']}", 'target': g['target_law'],
                       'articles': f'{lo}–{hi}', 'n': p['n'], 'basis': basis})
        sample.append((g, p, basis))
    total = sum(pins[g['key']]['n'] for g in cfg['groups'])
    st.insert(0, guard('guard_before', conds + [f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0"]))
    after = [f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={total}"]
    for g in cfg['groups']:
        ids = ','.join(lit(i) for i in g['article_ids'])
        after.append(f"(SELECT count(*) FROM legal_articles x WHERE x.id IN ({ids}) AND {latest_unit_status('x.id')}='ملغاة')={len(g['article_ids'])}")
    st.append(guard('guard_after', after))
    md5 = write_batch(out / 'statements.json', BY, st, {'groups': report, 'verification_rows': total})
    lines = [f"# عيّنة المالك — {cfg['batch']}", '', f'البصمة: `{md5}` · العبارات: {len(st)} · صفوف التحقق المضافة: {total} · لا تعديل ولا حذف.', '']
    for g, p, basis in sample:
        lines += [f"## {g['target_law']} — المواد {min(g['numbers'])}–{max(g['numbers'])} ({p['n']})",
                  f"- المُلغي: {g['repealer_law']}، المادة ({g['repealer_article']}).", f'- الأساس: {basis}.', f"- الرابط: {p['rep_url']}", '']
    (out / 'sample.md').write_text('\n'.join(lines), encoding='utf-8')
    print(len(st), md5, total)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('plan')
    p.add_argument('--ledger', required=True)
    p.add_argument('--batch', required=True)
    p.add_argument('--by', required=True)
    p.add_argument('--out', required=True)
    b = sp.add_parser('build')
    b.add_argument('--out', required=True)
    a = ap.parse_args()
    plan(a) if a.cmd == 'plan' else build(a)


if __name__ == '__main__':
    main()
