"""أدوات مشتركة لمولّدات دفعات النواقص — بصيغة scripts/apply-statements.py نفسها (إضافة فقط + حارس قبل وبعد + بصمة)."""
import hashlib, json, pathlib, re

# حارس يُفشل المعاملة كلها إن لم يتحقق الشرط (النمط نفسه في دفعات HKM-038/045)
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
DML = re.compile(r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b', re.I)


def lit(s):
    """نص حرفي آمن بعلامة $hk$ (كما في build_gcc.py)."""
    return '$hk$' + str(s).replace('$hk$', '$hk $') + '$hk$'


def h(*p):
    return hashlib.sha256('|'.join(str(x) for x in p).encode()).hexdigest()


def guard(name, conditions):
    """سطر واحد بفاصل « AND » بين الشروط: split_guard في scripts/apply-statements.py لا يقسم إلا هكذا،
    فيطبع عند الفشل أي شرط سقط (لا «None»)."""
    for c in conditions:
        if '\n' in c:
            raise ValueError('شرط حارس متعدد الأسطر')
    body = ' AND '.join(conditions)
    return f"SELECT CASE WHEN {body} THEN 'ok' ELSE {GUARD_FAIL} END AS {name}"


def latest_work_status(sid_expr):
    return (f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={sid_expr} "
            f"ORDER BY verified_at DESC, id DESC LIMIT 1)")


def latest_unit_status(aid_expr):
    return (f"(SELECT verified_status FROM verification v WHERE v.object_type='unit' AND v.object_id={aid_expr} "
            f"ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)")


def statement_ok(s):
    """نسخة من قاعدة apply-statements.py بلا --allow-guarded-update: INSERT، أو حارس SELECT CASE بلا أوامر كتابة."""
    if s.lstrip().upper().startswith('INSERT'):
        return True
    return bool(re.match(r'^\s*SELECT CASE WHEN', s)) and not DML.search(s)


def write_batch(path, by, statements, report, expect_delta=None):
    bad = [i for i, s in enumerate(statements) if not statement_ok(s)]
    if bad:
        raise SystemExit(f'عبارات ليست إضافة أو حارسًا: {bad}')
    md5 = hashlib.md5('\n'.join(statements).encode()).hexdigest()
    doc = {'by': by, 'md5': md5, 'count': len(statements), 'report': report,
           'expect_delta': expect_delta or {}, 'statements': statements}
    pathlib.Path(path).write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    return md5
