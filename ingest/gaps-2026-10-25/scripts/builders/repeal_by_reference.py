#!/usr/bin/env python3
"""مولّد دفعة U4b: تسجيل «ملغاة» لمواد ألغتها مادة في نظام لاحق موجودة في حكيم نفسه (إلغاء بالإحالة).

ثلاث خطوات، والكتابة الوحيدة في النهاية بإذن المالك (apply-statements.yml أو معاملة Neon واحدة بالحارسين):
  1) plan  : من ledger.jsonl (U4b route=build) → config.json وpins.sql (قراءة فقط).
             شغّل pins.sql بمعاملة READ ONLY واحفظ عمود pins في pins.json.
  2) effective.json : قرار القارئ في تاريخ نفاذ كل مادة مُلغية (readers/PROTOCOL.md). مجموعة بلا تاريخ لا تُبنى.
  3) build : config.json + pins.json + effective.json → statements.json وsample.md.

اصطلاح العرض في التطبيق (lib/modules/legal-core/verified-status.ts):
  evidence_instrument = «<أداة الإصدار> — المادة (ن) من <النظام المُلغي> — من YYYY-MM-DD»
  فيقرأ effectiveDateFromEvidence اليوم، ويقرأ instrumentKey الأداة ليربط بالنظام المُلغي.
الاقتباس حرفي من القاعدة (نص المادة المُلغية ومادة النفاذ)، وملاحظة المنهج في ذيل موسوم «[منهج HKM-047: …]».
"""
import argparse, collections, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import guard, h, latest_unit_status, latest_work_status, lit, write_batch  # noqa: E402

REPEALED = "('ملغاة','ملغى','مستبدل')"
PART_WORD = {1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن', 9: 'التاسع',
             10: 'العاشر', 11: 'الحادي عشر', 12: 'الثاني عشر'}
# أداة الإصدار وحدها من الديباجة: «مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ قرار مجلس الوزراء …» → حتى أول «هـ»
INSTR = "btrim(substring(s.preamble_royal_decree from '^(.*?هـ)'))"


def ranges(numbers):
    """أرقام مرتبة → مديات متصلة [(من، إلى)]."""
    out = []
    for n in sorted(set(numbers)):
        if out and n == out[-1][1] + 1:
            out[-1][1] = n
        else:
            out.append([n, n])
    return [tuple(r) for r in out]


def target_pred(g, alias='x'):
    """المواد المستهدفة بالنظام والمدى، بكل صفوفها المادية (يشمل المكرر)، لا بقائمة معرّفات: مكرر جديد داخل المدى يغيّر البصمة."""
    rs = ' OR '.join(f'{alias}."articleNumber" BETWEEN {a} AND {b}' for a, b in ranges(g['numbers']))
    return f'{alias}."legalSystemId"={lit(g["target_system_id"])} AND {alias}."articleBis"<100 AND ({rs})'


def plan(a):
    groups = collections.OrderedDict()
    seen = {}
    for line in open(a.ledger, encoding='utf-8'):
        it = json.loads(line)
        if it['gap'] != 'U4b' or it['route'] != 'build' or it['status'] != 'open':
            continue
        if it['article_id'] in seen:
            sys.exit(f"المادة {it['article_id']} مستهدفة من مُلغيين ({seen[it['article_id']]} و{it['repealer_article_id']}): تُحسم بقارئ قبل البناء")
        seen[it['article_id']] = it['repealer_article_id']
        k = (it['repealer_article_id'], it['target_system_id'])
        g = groups.setdefault(k, {'key': f'G{len(groups) + 1}', 'repealer_system_id': it['repealer_system_id'],
                                  'repealer_article_id': it['repealer_article_id'], 'repealer_law': it['repealer_law'],
                                  'repealer_article': it['repealer_article'], 'target_system_id': it['target_system_id'],
                                  'target_law': it['target_law'], 'target_law_as_cited': it['target_law_as_cited'],
                                  'kind': it['target_kind'], 'part': it.get('target_part'), 'basis': it['basis'],
                                  'identity_score': it.get('identity_score'), 'numbers': [], 'article_ids': []})
        g['numbers'].append(it['article_number'])
        g['article_ids'].append(it['article_id'])
    cfg = {'batch': a.batch, 'by': a.by, 'groups': list(groups.values())}
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'config.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf-8')
    parts = []
    for g in cfg['groups']:
        nums = ','.join(str(n) for n in sorted(set(g['numbers'])))
        parts.append(f"""SELECT {lit(g['key'])} k,
 (SELECT md5(content) FROM legal_articles WHERE id={lit(g['repealer_article_id'])}) rep_md5,
 (SELECT md5(s.name||'|'||coalesce(s.preamble_royal_decree,'')) FROM legal_systems s WHERE s.id={lit(g['repealer_system_id'])}) rep_sys_md5,
 (SELECT x.id FROM legal_articles x WHERE x."legalSystemId"={lit(g['repealer_system_id'])} AND x."articleBis"=0 AND x.content ~ '^\\s*(يعمل|يُعمل|ينشر)[^.]*' AND x."articleNumber" >= (SELECT max("articleNumber")-3 FROM legal_articles WHERE "legalSystemId"={lit(g['repealer_system_id'])} AND "articleBis"=0) ORDER BY x."articleNumber" DESC LIMIT 1) eff_id,
 (SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x."articleNumber", x."articleBis")) FROM legal_articles x WHERE {target_pred(g)}) set_md5,
 (SELECT count(*) FROM legal_articles x WHERE {target_pred(g)}) n,
 (SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id={lit(g['target_system_id'])} JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id
    WHERE u.css_class LIKE '%canceled%' AND u.article_number IN ({nums})) boe_struck,
 (SELECT l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id={lit(g['repealer_system_id'])} ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_url,
 (SELECT l.guid FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id={lit(g['repealer_system_id'])} ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_guid,
 (SELECT l.published_gregorian::date FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id={lit(g['repealer_system_id'])} ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_published""")
    sql = ("-- قراءة فقط. شغّله داخل BEGIN; SET TRANSACTION READ ONLY; … ROLLBACK;\n"
           "WITH p AS (\n" + "\nUNION ALL\n".join(parts) + "\n)\n"
           "SELECT 'PINS' tag, json_agg(json_build_object('k',k,'rep_md5',rep_md5,'rep_sys_md5',rep_sys_md5,'eff_id',eff_id,"
           "'eff_md5',(SELECT md5(content) FROM legal_articles WHERE id=eff_id),'eff_text',(SELECT content FROM legal_articles WHERE id=eff_id),"
           "'set_md5',set_md5,'n',n,'boe_struck',boe_struck,'rep_url',rep_url,'rep_guid',rep_guid,'rep_published',rep_published)) pins FROM p;\n")
    (out / 'pins.sql').write_text(sql, encoding='utf-8')
    print(f"{len(cfg['groups'])} مجموعة، {sum(len(g['numbers']) for g in cfg['groups'])} مادة → {out}/config.json و pins.sql")


def build(a):
    out = pathlib.Path(a.out)
    cfg = json.loads((out / 'config.json').read_text(encoding='utf-8'))
    pins = {p['k']: p for p in json.loads((out / 'pins.json').read_text(encoding='utf-8'))}
    eff = json.loads((out / 'effective.json').read_text(encoding='utf-8'))
    BY = cfg['by']
    st, report, sample, deferred, conds = [], [], [], [], []
    built = []
    for g in cfg['groups']:
        p = pins[g['key']]
        e = eff.get(g['repealer_article_id'])
        if not e or not e.get('effective_from'):
            deferred.append({'group': g['key'], 'target': g['target_law'], 'articles': f"{min(g['numbers'])}–{max(g['numbers'])}",
                             'n': p['n'], 'repealer': f"{g['repealer_law']} م{g['repealer_article']}",
                             'reason': (e or {}).get('pending') or 'لا قرار قارئ في تاريخ النفاذ'})
            continue
        assert p['n'] == len(g['article_ids']), (g['key'], p['n'], len(g['article_ids']))
        assert all(p[k] for k in ('eff_id', 'rep_md5', 'rep_sys_md5', 'set_md5', 'rep_url')), g['key']
        built.append(g)
        pred = target_pred(g)
        lo, hi = min(g['numbers']), max(g['numbers'])
        c = [
            f"(SELECT count(*) FROM legal_articles WHERE id={lit(g['repealer_article_id'])} AND \"legalSystemId\"={lit(g['repealer_system_id'])} AND md5(content)={lit(p['rep_md5'])})=1",
            f"(SELECT count(*) FROM legal_articles WHERE id={lit(p['eff_id'])} AND \"legalSystemId\"={lit(g['repealer_system_id'])} AND md5(content)={lit(p['eff_md5'])})=1",
            f"(SELECT md5(s.name||'|'||coalesce(s.preamble_royal_decree,'')) FROM legal_systems s WHERE s.id={lit(g['repealer_system_id'])})={lit(p['rep_sys_md5'])}",
            f"(SELECT count(*) FROM legal_systems s WHERE s.id={lit(g['repealer_system_id'])} AND coalesce({INSTR},'') ~ 'رقم')=1",
            f"{latest_work_status(lit(g['repealer_system_id']))}='ساري'",
            f"{latest_work_status(lit(g['target_system_id']))}='ساري'",
            f"(SELECT count(*) FROM legal_articles x WHERE {pred})={p['n']}",
            f"(SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x.\"articleNumber\", x.\"articleBis\")) FROM legal_articles x WHERE {pred})={lit(p['set_md5'])}",
            f"(SELECT count(*) FROM legal_articles x WHERE {pred} AND coalesce({latest_unit_status('x.id')},'') IN {REPEALED})=0",
            f"(SELECT count(*) FROM legal_articles x JOIN unit_version v ON v.unit_id=x.id WHERE {pred})=0",
            f"(SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id={lit(g['target_system_id'])} JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id WHERE u.css_class LIKE '%canceled%' AND u.article_number BETWEEN {lo} AND {hi})>={p['boe_struck']}",
        ]
        if e.get('rule') == 'publication_plus_days':  # اليوم المكتوب مربوط ببيانات المصدر لا بذاكرة القارئ
            c.append(f"(SELECT (published_gregorian::date + {int(e['days'])}) FROM boe.law WHERE guid={lit(p['rep_guid'])} ORDER BY id LIMIT 1)={lit(e['effective_from'])}::date")
        if g['kind'] == 'part':  # حدود الباب: أول مادة تحمل عنوانه، والتي بعد آخرها تحمل عنوان الباب التالي، ولا عنوان باب بينهما
            word = PART_WORD[g['part']]
            sid = lit(g['target_system_id'])
            c.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={sid} AND \"articleNumber\"={lo} AND \"articleBis\"=0 AND chapter LIKE {lit('الباب%' + word + '%')})=1")
            c.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={sid} AND \"articleNumber\"={hi + 1} AND \"articleBis\"=0 AND chapter LIKE 'الباب%')=1")
            c.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\"={sid} AND \"articleNumber\" BETWEEN {lo + 1} AND {hi} AND \"articleBis\"<100 AND chapter LIKE 'الباب%')=0")
        conds += c
        struck = (f"الهيئة تشطب {p['boe_struck']} من {p['n']}" if p['boe_struck'] else 'الهيئة لا تشطبها')
        method = f"{g['basis']}؛ {struck}؛ تاريخ النفاذ: {e['basis']}"
        if g.get('identity_note'):
            method += f"؛ الهوية: {g['identity_note']}"
        instrument = (f"{INSTR}||' — المادة ('||r.\"articleNumber\"||') من '||s.name||' — من '||{lit(e['effective_from'])}")
        quote = (f"'المادة ('||r.\"articleNumber\"||') من '||s.name||': «'||btrim(r.content)||'» — المادة ('||e.\"articleNumber\"||'): «'||btrim(e.content)||'»'"
                 f"||' [منهج HKM-047: '||{lit(method)}||']'")
        st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT 'vfg1-'||left(encode(sha256(convert_to({lit(BY)}||'|'||x.id||'|ملغاة','UTF8')),'hex'),24), 'unit', x.id, 'ملغاة',
  {instrument}, {lit(p['rep_url'])}, {quote}, 'rule', {lit(BY)}, NULL
FROM legal_articles x
JOIN legal_articles r ON r.id={lit(g['repealer_article_id'])}
JOIN legal_articles e ON e.id={lit(p['eff_id'])}
JOIN legal_systems s ON s.id=r."legalSystemId"
WHERE {pred} ORDER BY x."articleNumber", x."articleBis\"""")
        report.append({'group': g['key'], 'repealer': f"{g['repealer_law']} م{g['repealer_article']}", 'target': g['target_law'],
                       'articles': f'{lo}–{hi}', 'n': p['n'], 'effective_from': e['effective_from'], 'method': method})
        sample.append((g, p, e, method))
    if not built:
        sys.exit('لا مجموعة جاهزة (كلها بلا تاريخ نفاذ)')
    total = sum(pins[g['key']]['n'] for g in built)
    st.insert(0, guard('guard_before', conds + [f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0"]))
    after = [f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={total}"]
    for g in built:
        after.append(f"(SELECT count(*) FROM legal_articles x WHERE {target_pred(g)} AND {latest_unit_status('x.id')}='ملغاة')={pins[g['key']]['n']}")
    st.append(guard('guard_after', after))
    md5 = write_batch(out / 'statements.json', BY, st, {'groups': report, 'deferred': deferred, 'verification_rows': total})
    lines = [f"# عيّنة المالك — {cfg['batch']}", '', f'البصمة: `{md5}`', '', f'العبارات: {len(st)}؛ صفوف التحقق المضافة: {total}؛ لا تعديل ولا حذف.', '']
    for g, p, e, method in sample:
        lines += [f"## {g['target_law']} — المواد {min(g['numbers'])}–{max(g['numbers'])} ({p['n']})",
                  f"- المُلغي: {g['repealer_law']}، المادة ({g['repealer_article']}).",
                  f"- يُعمل بالإلغاء من: {e['effective_from']}.", f'- المنهج: {method}.', f"- الرابط: {p['rep_url']}", '']
    if deferred:
        lines += ['## مؤجل إلى دفعة لاحقة', '']
        lines += [f"- {d['target']} {d['articles']} ({d['n']}) — {d['repealer']}: {d['reason']}." for d in deferred]
        lines += ['']
    lines += ['الصف كما سيظهر في القاعدة: انظر `sample_rows.md` (يكتبه tests/test_gap001.py من تثبيت محلي).']
    (out / 'sample.md').write_text('\n'.join(lines), encoding='utf-8')
    print(len(st), md5, total, 'deferred:', [d['group'] for d in deferred])


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
