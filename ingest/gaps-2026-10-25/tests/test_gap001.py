#!/usr/bin/env python3
"""اختبار دفعة gap001 على PostgreSQL محلية ببيانات مطابقة لعيّنة من الإنتاج (المدونة عامة، لا بيانات مستخدمين).

يشغّل أداة المستودع نفسها scripts/apply-statements.py (لا نسخة منها) في الوضعين preview وapply، ثم:
  - التكرار يُرفض (الحارس قبل الكتابة)،
  - العبث بنص مادة واحدة يُفشل المعاملة كلها ولا يكتب شيئًا،
  - وجود حالة إلغاء سابقة لمادة يُفشلها،
  - الجوار خارج المدى لا يُمس.
  python3 tests/test_gap001.py
"""
import hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, time

import psycopg2

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parent.parent
BATCH = ROOT / 'batches' / 'gap001-repeal-by-reference' / 'statements.json'
FIX = HERE / 'fixtures' / 'gap001_prod_subset_2026-10-25.json'
APPLY = REPO / 'scripts' / 'apply-statements.py'
PG = pathlib.Path('/usr/lib/postgresql/16/bin')
sys.path.insert(0, str(ROOT / 'scripts' / 'builders'))
from common import statement_ok  # noqa: E402

SCHEMA = """
CREATE SCHEMA boe;
CREATE TABLE legal_systems (id text PRIMARY KEY, name text, classification text, "articleCount" int, preamble_royal_decree text,
  preamble_effective_from timestamp, instrument_kind text);
CREATE TABLE legal_articles (id text PRIMARY KEY, "legalSystemId" text REFERENCES legal_systems(id), "lawName" text, "articleNumber" int,
  "articleBis" int DEFAULT 0, title text, content text, chapter text, status text, CONSTRAINT legal_articles_article_number_positive CHECK ("articleNumber" > 0));
CREATE TABLE verification (id text PRIMARY KEY, object_type text NOT NULL, object_id text NOT NULL, verified_status text NOT NULL, evidence_instrument text,
  evidence_url text, evidence_quote text, method text NOT NULL, verified_by text, verified_at timestamptz NOT NULL DEFAULT now(), supersedes_verification_id text,
  CONSTRAINT verification_method_check CHECK (method = ANY (ARRAY['rule','manual','owner_decision'])),
  CONSTRAINT verification_object_type_check CHECK (object_type = ANY (ARRAY['work','unit','effect','relation'])),
  CONSTRAINT verification_verified_status_check CHECK (verified_status = ANY (ARRAY['ساري','صادر لم يسرِ بعد','ملغى','مستبدل','ملغى مع بقاء أحكام محددة مؤقتًا','إلغاء جزئي معلّق على شرط','ملغاة','مضافة','سجل مخلوط — لا يُعرض'])));
CREATE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append only'; END $$;
CREATE TRIGGER verification_append_only BEFORE UPDATE OR DELETE ON verification FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
CREATE TABLE unit_version (id text PRIMARY KEY, unit_id text, body text, valid_from timestamptz, evidence_instrument text, evidence_url text,
  evidence_quote text, created_at timestamptz DEFAULT now());
CREATE TABLE legal_text_provenance (id text PRIMARY KEY, source_id text);
CREATE TABLE boe.law (id text PRIMARY KEY, guid text, url text, name text, status_at_source text, issued_gregorian timestamptz, published_gregorian timestamptz);
CREATE TABLE boe.unit (law_id text, seq int, article_number int, is_bis bool, css_class text, PRIMARY KEY (law_id, seq));
CREATE TABLE boe.match (id text PRIMARY KEY, guid text, hakeem_system_id text, method text, candidates jsonb, decided_by text, decided_at timestamptz);
CREATE VIEW boe.current_match AS SELECT DISTINCT ON (guid) id, guid, hakeem_system_id, method, candidates, decided_by, decided_at FROM boe.match ORDER BY guid, decided_at DESC, id DESC;
CREATE TABLE boe.review_proposal (id text PRIMARY KEY);
CREATE TABLE boe.owner_decision (id text PRIMARY KEY);
"""


def load(con, fx):
    cur = con.cursor()
    cur.execute(SCHEMA)
    def ins(table, rows, cols):
        for r in rows or []:
            cur.execute(f'INSERT INTO {table} ({",".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({",".join(["%s"] * len(cols))})',
                        [json.dumps(r[c]) if isinstance(r.get(c), (dict, list)) else r.get(c) for c in cols])
    ins('legal_systems', fx['systems'], ['id', 'name', 'classification', 'articleCount', 'preamble_royal_decree', 'preamble_effective_from', 'instrument_kind'])
    ins('legal_articles', fx['articles'], ['id', 'legalSystemId', 'lawName', 'articleNumber', 'articleBis', 'title', 'content', 'chapter', 'status'])
    ins('verification', fx['verification'], ['id', 'object_type', 'object_id', 'verified_status', 'evidence_instrument', 'evidence_url', 'evidence_quote', 'method', 'verified_by', 'verified_at', 'supersedes_verification_id'])
    ins('boe.law', fx['boe_law'], ['id', 'guid', 'url', 'name', 'status_at_source', 'issued_gregorian', 'published_gregorian'])
    ins('boe.unit', fx['boe_unit'], ['law_id', 'seq', 'article_number', 'is_bis', 'css_class'])
    ins('boe.match', fx['boe_match'], ['id', 'guid', 'hakeem_system_id', 'method', 'candidates', 'decided_by', 'decided_at'])
    con.commit()


class Cluster:
    def __init__(self):
        self.dir = pathlib.Path(tempfile.mkdtemp(prefix='gap001-pg-'))
        shutil.chown(self.dir, 'postgres', 'postgres')
        self.port = 55432 + os.getpid() % 1000
        run = lambda *c: subprocess.run(['runuser', '-u', 'postgres', '--', *c], check=True, capture_output=True)
        run(str(PG / 'initdb'), '-D', str(self.dir / 'd'), '-A', 'trust', '-E', 'UTF8', '--locale=C.UTF-8')
        run(str(PG / 'pg_ctl'), '-D', str(self.dir / 'd'), '-o', f'-p {self.port} -k {self.dir}', '-l', str(self.dir / 'log'), '-w', 'start')
        self.run = run

    def db(self, name):
        c = psycopg2.connect(host=str(self.dir), port=self.port, user='postgres', dbname='postgres')
        c.autocommit = True
        c.cursor().execute(f'CREATE DATABASE "{name}"')
        c.close()
        url = f'postgresql://postgres@/{name}?host={self.dir}&port={self.port}'
        return url, psycopg2.connect(host=str(self.dir), port=self.port, user='postgres', dbname=name)

    def stop(self):
        self.run(str(PG / 'pg_ctl'), '-D', str(self.dir / 'd'), '-m', 'fast', 'stop')
        shutil.rmtree(self.dir, ignore_errors=True)


def apply(url, mode, batch):
    env = dict(os.environ, DATABASE_URL=url)
    p = subprocess.run([sys.executable, str(APPLY), '--file', str(BATCH), '--mode', mode, '--expect-md5', batch['md5']],
                       env=env, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def delta(out):
    """فرق جدول التحقق كما تطبعه أداة المستودع (لا عدد الصفوف الخام: الحارسان يُعدّان صفين)."""
    try:
        doc = json.loads(out[out.index('{'): out.rindex('}') + 1])
        return doc['delta']['public.verification']
    except Exception:
        return None


def scalar(con, q, *a):
    cur = con.cursor()
    cur.execute(q, a)
    return cur.fetchone()[0]


def fresh(cl, name, fx, mutate=None):
    url, con = cl.db(name)
    load(con, fx)
    if mutate:
        con.cursor().execute(mutate)
        con.commit()
    return url, con


def main():
    batch = json.load(open(BATCH, encoding='utf-8'))
    fx = json.load(open(FIX, encoding='utf-8'))
    cfg = json.load(open(BATCH.parent / 'config.json', encoding='utf-8'))
    built = {r['group'] for r in batch['report']['groups']}
    N = batch['report']['verification_rows']
    ids = [a for g in cfg['groups'] if g['key'] in built for a in g['article_ids']]
    deferred_ids = [a for g in cfg['groups'] if g['key'] not in built for a in g['article_ids']]
    results = []
    def check(name, cond, detail=''):
        results.append((name, bool(cond), detail))
        print(('PASS' if cond else 'FAIL'), name, detail if not cond else '')

    # فحوص ساكنة
    check('md5 الملف = md5 العبارات', hashlib.md5('\n'.join(batch['statements']).encode()).hexdigest() == batch['md5'])
    check('كل العبارات إضافة أو حارس قراءة', all(statement_ok(s) for s in batch['statements']))
    check('الحارسان سطر واحد (تشخيص split_guard)', all('\n' not in s for s in batch['statements'] if s.startswith('SELECT CASE')))
    check('لا تغيير في عدد المواد والأنظمة', batch['expect_delta'] == {})
    check(f'{N} مادة بلا تكرار', len(ids) == N == len(set(ids)))

    latest = """SELECT count(*) FROM legal_articles x WHERE x.id = ANY(%s) AND (SELECT verified_status FROM verification v WHERE v.object_type='unit' AND v.object_id=x.id ORDER BY v.verified_at DESC, v.id DESC LIMIT 1)='ملغاة'"""
    cl = Cluster()
    try:
        # 1) معاينة ثم تثبيت ثم تكرار
        url, con = fresh(cl, 't_main', fx)
        v0 = scalar(con, 'SELECT count(*) FROM verification')
        rc, out = apply(url, 'preview', batch)
        check(f'preview ينجح ويتراجع (+{N} داخل المعاملة)', rc == 0 and 'ROLLED BACK' in out and delta(out) == N, out[-400:])
        check('preview لم يكتب', scalar(con, 'SELECT count(*) FROM verification') == v0)
        rc, out = apply(url, 'apply', batch)
        check(f'apply يثبّت +{N}', rc == 0 and 'COMMITTED' in out and delta(out) == N, out[-400:])
        check('كل المستهدفة «ملغاة»', scalar(con, latest, ids) == N)
        check('المؤجلة لم تُمس', scalar(con, 'SELECT count(*) FROM verification WHERE object_id = ANY(%s)', deferred_ids) == 0)
        neigh = scalar(con, """SELECT count(*) FROM legal_articles x JOIN verification v ON v.object_id=x.id WHERE
            (x."legalSystemId"='cmpwi0cw90024nxff1u02k8rn' AND x."articleNumber" IN (100,159)) OR (x."legalSystemId"='cmpwi0ckf0022nxffiy84kp3o' AND x."articleNumber" IN (37,58))""")
        check('الجوار خارج المدى لم يُمس', neigh == 0)
        cur = con.cursor()
        cur.execute("SELECT evidence_instrument, evidence_quote, evidence_url FROM verification WHERE verified_by=%s AND object_id='cmpwiaooe01sdnxffzl83r2rd'", (batch['by'],))
        ins, q, u = cur.fetchone()
        m = re.search(r'من\s+(\d{4}-\d{2}-\d{2})', ins)  # effectiveDateFromEvidence في verified-status.ts
        n = re.search(r'رقم[ \t]*[(]?[ \t]*((?:[مأاإ][ \t]*/[ \t]*)?[0-9]+)', ins)  # parseInstrumentHeading
        check('تاريخ النفاذ يقرؤه التطبيق (2022-07-06)', m and m.group(1) == '2022-07-06', ins)
        check('رقم الأداة يقرؤه التطبيق (م/43)', n and n.group(1).replace(' ', '') == 'م/43', ins)
        check('الأداة تسمّي النظام والمادة', 'المادة (128) من نظام الإثبات' in ins, ins)
        check('الاقتباس حرفي ثم ذيل المنهج', q.startswith('المادة (128) من نظام الإثبات: «يلغي هذا النظام الباب (التاسع)') and 'المادة (129): «يعمل بهذا النظام' in q and '[منهج HKM-048:' in q, q[:200])
        rows = []
        for g in cfg['groups']:
            if g['key'] not in built:
                continue
            cur.execute("SELECT x.\"lawName\", x.\"articleNumber\", v.id, v.verified_status, v.evidence_instrument, v.evidence_url, v.evidence_quote, v.method, v.verified_by FROM verification v JOIN legal_articles x ON x.id=v.object_id WHERE v.verified_by=%s AND v.object_id=%s", (batch['by'], g['article_ids'][0]))
            rows.append(cur.fetchone())
        md = ['# الصف كما سيُكتب (من تثبيت محلي بأداة المستودع)', '', f"البصمة `{batch['md5']}`", '']
        for r in rows:
            md += [f'## {r[0]} — المادة {r[1]}', '', f'- id: `{r[2]}`', f'- الحالة: {r[3]}', f'- الأداة (evidence_instrument): {r[4]}',
                   f'- الرابط: {r[5]}', f'- الطريقة: {r[7]} · بواسطة: `{r[8]}`', '', '> ' + r[6].replace('\n', ' '), '']
        (BATCH.parent / 'sample_rows.md').write_text('\n'.join(md), encoding='utf-8')
        rc, out = apply(url, 'apply', batch)
        check('التكرار مرفوض بالحارس مع تشخيص الشرط', rc != 0 and 'شروط الحارس الفاشلة: [' in out, out[-300:])
        check('التكرار لم يكتب', scalar(con, 'SELECT count(*) FROM verification WHERE verified_by=%s', batch['by']) == N)
        con.close()

        # 2) محاولات كسر: كل واحدة على قاعدة جديدة، والمتوقع رفض المعاملة كلها بلا كتابة
        attacks = {
            'عبث بنص مادة مستهدفة': "UPDATE legal_articles SET content = content || ' ' WHERE id='cmpwiaooe01sdnxffzl83r2rd'",
            'حالة إلغاء سابقة لمادة': "INSERT INTO verification (id, object_type, object_id, verified_status, method, verified_by) VALUES ('x1','unit','cmpwi92l101ipnxffq4njay6p','ملغاة','manual','test')",
            'النظام المستهدف لم يعد ساريًا': "INSERT INTO verification (id, object_type, object_id, verified_status, method, verified_by, verified_at) VALUES ('x2','work','cmpwi0ckf0022nxffiy84kp3o','مستبدل','manual','test', now()+interval '1 day')",
            'مادة مكررة جديدة داخل المدى (120 مكرر)': "INSERT INTO legal_articles (id, \"legalSystemId\", \"lawName\", \"articleNumber\", \"articleBis\", content) VALUES ('bis120','cmpwi0cw90024nxff1u02k8rn','نظام المرافعات الشرعية',120,1,'نص')",
            'نسخة مادة لمستهدفة': "INSERT INTO unit_version (id, unit_id, body, valid_from) VALUES ('uv1','cmpwiaooe01sdnxffzl83r2rd','نص','2020-01-01')",
            'تعديل ديباجة النظام المُلغي': "UPDATE legal_systems SET preamble_royal_decree = preamble_royal_decree || ' ' WHERE id='cmpz5pbv80021cwg2br8calht'",
            'تاريخ نشر مختلف في بطاقة الهيئة': "UPDATE boe.law SET published_gregorian = published_gregorian + interval '1 day' WHERE guid='2716057c-c097-4bad-8e1e-ae1400c678d5'",
            'صف هيئة ثانٍ بتاريخ نشر آخر': "INSERT INTO boe.law (id, guid, url, name, status_at_source, issued_gregorian, published_gregorian) SELECT id || '-2', guid, url, name, status_at_source, issued_gregorian, '2022-02-01' FROM boe.law WHERE guid='2716057c-c097-4bad-8e1e-ae1400c678d5'",
            'حذف علامة الباب العاشر': "UPDATE legal_articles SET chapter = NULL WHERE \"legalSystemId\"='cmpwi0cw90024nxff1u02k8rn' AND \"articleNumber\"=159",
        }
        for i, (name, sql) in enumerate(attacks.items()):
            url, con = fresh(cl, f't_attack{i}', fx, sql)
            rc, out = apply(url, 'apply', batch)
            check(f'يُرفض: {name}', rc != 0 and scalar(con, 'SELECT count(*) FROM verification WHERE verified_by=%s', batch['by']) == 0, out[-200:])
            con.close()
    finally:
        cl.stop()
    ok = all(r[1] for r in results)
    (HERE / 'last_run.json').write_text(json.dumps({'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'batch_md5': batch['md5'],
                                                    'passed': sum(r[1] for r in results), 'total': len(results),
                                                    'results': [{'check': n, 'pass': p} for n, p, _ in results]}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"{sum(r[1] for r in results)}/{len(results)}")
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
